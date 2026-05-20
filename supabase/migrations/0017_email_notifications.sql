-- 0017_email_notifications.sql
--
-- Transactional emails via Resend. Architecture:
--   notifications insert OR workspace_invitations insert
--     → dispatch_email() trigger
--       → pg_net HTTP POST to send-email Edge Function (Deno)
--         → Edge Function reads prefs, renders template, calls Resend API,
--           writes email_log row, retries on 5xx with backoff.
--   Resend webhooks → resend-webhook Edge Function
--     → marks profile.email_status = 'bounced' / 'complained'.
--
-- After this migration runs, two follow-up steps are required:
--   1. Update vault secrets `send_email_url` and `send_email_secret` with
--      real values (Dashboard → Project Settings → Vault).
--   2. Deploy the Edge Functions (`supabase functions deploy send-email` etc.).
-- Without those, dispatch_email() no-ops gracefully (no errors raised).

-- 1. Extensions ------------------------------------------------------------

create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- 2. Vault placeholders ---------------------------------------------------
-- These are stub values. After deploying the edge function and generating
-- a real shared secret, update them via Dashboard → Project Settings → Vault.

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'send_email_url') then
    perform vault.create_secret(
      'https://YOUR-PROJECT-REF.functions.supabase.co/send-email',
      'send_email_url',
      'URL of the send-email Edge Function (update post-deploy)'
    );
  end if;
  if not exists (select 1 from vault.secrets where name = 'send_email_secret') then
    perform vault.create_secret(
      'replace-me-with-a-32-byte-random-hex',
      'send_email_secret',
      'Shared secret between dispatch_email trigger and send-email Edge Function'
    );
  end if;
end $$;

-- 3. email_preferences table ----------------------------------------------

create table public.email_preferences (
  user_id           uuid primary key references public.profiles(id) on delete cascade,
  notify_assigned   boolean not null default true,
  notify_mention    boolean not null default true,
  notify_comment    boolean not null default true,
  notify_invite     boolean not null default true,
  unsubscribe_token text   not null default (gen_random_uuid()::text || '-' || gen_random_uuid()::text),
  updated_at        timestamptz not null default now()
);

create unique index email_preferences_unsub_idx
  on public.email_preferences(unsubscribe_token);

alter table public.email_preferences enable row level security;

create policy "email_preferences_select_own" on public.email_preferences
  for select to authenticated using (user_id = auth.uid());

create policy "email_preferences_update_own" on public.email_preferences
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Backfill rows for existing profiles.
insert into public.email_preferences (user_id)
select id from public.profiles
on conflict do nothing;

-- 4. profiles.email_status -----------------------------------------------
-- 'ok' = sendable, 'bounced'/'complained' = stop sending. Set by the
-- resend-webhook Edge Function when Resend reports a hard failure.

alter table public.profiles
  add column if not exists email_status text not null default 'ok'
    check (email_status in ('ok', 'bounced', 'complained'));

-- 5. email_log table ------------------------------------------------------
-- Append-only audit of every email attempt. The send-email function writes
-- 'queued' on entry, then updates to 'sent' / 'failed' / 'skipped'.

create table public.email_log (
  id                 uuid primary key default gen_random_uuid(),
  recipient_id       uuid references public.profiles(id) on delete set null,
  template           text not null,
  status             text not null check (status in
    ('queued', 'sent', 'failed', 'skipped', 'bounced', 'complained')),
  resend_message_id  text,
  notification_id    uuid references public.notifications(id) on delete set null,
  invitation_id      uuid references public.workspace_invitations(id) on delete set null,
  payload            jsonb,
  error_message      text,
  retry_count        integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index email_log_recipient_idx on public.email_log(recipient_id, created_at desc);
create index email_log_status_idx on public.email_log(status)
  where status in ('failed', 'queued');

alter table public.email_log enable row level security;

create policy "email_log_select_own" on public.email_log
  for select to authenticated using (recipient_id = auth.uid());

-- 6. handle_new_user: also create email_preferences row ------------------
-- Re-create from 0003_triggers.sql to also seed an email_preferences row
-- alongside the profile + default workspace.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _ws_id     uuid;
  _user_name text;
begin
  _user_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, full_name)
  values (new.id, _user_name);

  insert into public.workspaces (name, owner_id)
  values (_user_name || '''s Workspace', new.id)
  returning id into _ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (_ws_id, new.id, 'owner');

  insert into public.email_preferences (user_id) values (new.id);

  return new;
end;
$$;

-- 7. dispatch_email function ---------------------------------------------
-- Fires a non-blocking HTTP POST to the Edge Function. Failures don't
-- abort the parent transaction. The function returns void; pg_net handles
-- delivery asynchronously and surfaces results via net._http_response.

create or replace function public.dispatch_email(_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _url    text;
  _secret text;
begin
  select decrypted_secret into _url
  from vault.decrypted_secrets where name = 'send_email_url';

  select decrypted_secret into _secret
  from vault.decrypted_secrets where name = 'send_email_secret';

  -- Graceful no-op if secrets aren't configured yet.
  if _url is null or _secret is null
     or _url like '%YOUR-PROJECT-REF%'
     or _secret like 'replace-me%'
  then
    raise notice 'dispatch_email skipped: vault secrets not configured';
    return;
  end if;

  perform net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Shared-Secret', _secret
    ),
    body := _payload
  );
end;
$$;

revoke all on function public.dispatch_email(jsonb) from public;

-- 8. Trigger on notifications insert -------------------------------------

create or replace function public.handle_notification_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only email-worthy types. Others stay in-app only.
  if new.type not in ('assigned', 'mention', 'comment') then
    return new;
  end if;

  perform public.dispatch_email(jsonb_build_object(
    'kind', 'notification',
    'notification_id', new.id
  ));

  return new;
end;
$$;

drop trigger if exists on_notification_email on public.notifications;
create trigger on_notification_email
  after insert on public.notifications
  for each row execute function public.handle_notification_email();

-- 9. Trigger on workspace_invitations insert -----------------------------

create or replace function public.handle_invitation_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only send if an email was provided. Token-only invites stay copy-paste.
  if new.invited_email is null or new.invited_email = '' then
    return new;
  end if;

  perform public.dispatch_email(jsonb_build_object(
    'kind', 'invitation',
    'invitation_id', new.id
  ));

  return new;
end;
$$;

drop trigger if exists on_invitation_email on public.workspace_invitations;
create trigger on_invitation_email
  after insert on public.workspace_invitations
  for each row execute function public.handle_invitation_email();

-- 10. Unsubscribe RPC -----------------------------------------------------
-- Token-based, no auth required. The token is included in email footers
-- as `?token=<unsubscribe_token>&kind=<category>`.

create or replace function public.unsubscribe_email(_token text, _kind text default 'all')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _pref_id uuid;
begin
  select user_id into _pref_id
  from public.email_preferences
  where unsubscribe_token = _token;

  if not found then
    return false;
  end if;

  if _kind = 'all' then
    update public.email_preferences
    set notify_assigned = false,
        notify_mention  = false,
        notify_comment  = false,
        notify_invite   = false,
        updated_at      = now()
    where user_id = _pref_id;
  elsif _kind = 'assigned' then
    update public.email_preferences
    set notify_assigned = false, updated_at = now()
    where user_id = _pref_id;
  elsif _kind = 'mention' then
    update public.email_preferences
    set notify_mention = false, updated_at = now()
    where user_id = _pref_id;
  elsif _kind = 'comment' then
    update public.email_preferences
    set notify_comment = false, updated_at = now()
    where user_id = _pref_id;
  elsif _kind = 'invite' then
    update public.email_preferences
    set notify_invite = false, updated_at = now()
    where user_id = _pref_id;
  else
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.unsubscribe_email(text, text) from public;
grant execute on function public.unsubscribe_email(text, text) to anon, authenticated;

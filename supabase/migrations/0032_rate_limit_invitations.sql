-- 0032_rate_limit_invitations.sql — cap how many emailed invitations a single
-- user can create per hour / per day.
--
-- Finding B (audit v2): invitations_insert_members (0005) lets any workspace
-- member create invitations, and every signup owns its own workspace, so ANY
-- authenticated account (open signup → anyone) can create unlimited emailed
-- invitations to arbitrary addresses. Each one fires handle_invitation_email
-- (0017) → send-email → a branded message from the verified domain, with the
-- workspace name + inviter display name (both attacker-controlled) in the body.
-- With no throttle this is an arbitrary-recipient phishing/spam relay.
--
-- Fix: a BEFORE INSERT trigger that counts the inserter's recent EMAILED
-- invitations and rejects once over the cap. Server-side, so it can't be
-- bypassed via the raw PostgREST API. Token-only invites (no invited_email)
-- send no mail and are not a relay vector, so they're neither counted nor
-- limited. SECURITY DEFINER so the count sees all of the user's rows
-- regardless of which workspaces they can currently SELECT.
--
-- Caps (per creator): 20/hour, 100/day. Generous for real team setup, low
-- enough to stop bulk abuse. The RAISE messages are user-facing — the client's
-- existing onError toast surfaces them verbatim.

create or replace function public.enforce_invitation_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _hour_count int;
  _day_count  int;
begin
  -- Only emailed invites send mail; token-only links are harmless.
  if new.invited_email is null or new.invited_email = '' then
    return new;
  end if;
  if new.created_by is null then
    return new;
  end if;

  select count(*) into _hour_count
  from public.workspace_invitations
  where created_by = new.created_by
    and invited_email is not null and invited_email <> ''
    and created_at > now() - interval '1 hour';
  if _hour_count >= 20 then
    raise exception 'You can send at most 20 invites per hour. Please try again later.'
      using errcode = 'check_violation';
  end if;

  select count(*) into _day_count
  from public.workspace_invitations
  where created_by = new.created_by
    and invited_email is not null and invited_email <> ''
    and created_at > now() - interval '24 hours';
  if _day_count >= 100 then
    raise exception 'You can send at most 100 invites per day. Please try again later.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists on_invitation_rate_limit on public.workspace_invitations;
create trigger on_invitation_rate_limit
  before insert on public.workspace_invitations
  for each row execute function public.enforce_invitation_rate_limit();

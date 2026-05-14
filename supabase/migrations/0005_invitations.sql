-- 0005_invitations.sql — workspace invitations via shareable token-based links.
--
-- Flow: a workspace member inserts a row in workspace_invitations. The app
-- builds a URL like /invite/{token} and copies it to the clipboard. The
-- recipient opens the link, signs in or signs up, and the app calls the
-- accept_invitation() RPC which joins them to the workspace.
--
-- Reading an invitation by token is allowed without being a workspace member
-- (otherwise nobody could accept an invite to a workspace they aren't yet
-- part of). That bypass is implemented via a SECURITY DEFINER function so
-- the table itself stays RLS-locked to members.

create table public.workspace_invitations (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  invited_email  text,                                    -- nullable; just for display/audit
  token          text not null,
  role           text not null default 'member' check (role in ('owner', 'member')),
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default (now() + interval '7 days'),
  accepted_at    timestamptz,
  accepted_by    uuid references public.profiles(id)
);

create unique index workspace_invitations_token_idx on public.workspace_invitations(token);
create index workspace_invitations_workspace_id_idx on public.workspace_invitations(workspace_id);

alter table public.workspace_invitations enable row level security;

-- Workspace members can list / create / revoke invitations for their workspace.
create policy "invitations_select_members" on public.workspace_invitations
  for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "invitations_insert_members" on public.workspace_invitations
  for insert to authenticated with check (
    public.is_workspace_member(workspace_id) and created_by = auth.uid()
  );

create policy "invitations_delete_members" on public.workspace_invitations
  for delete to authenticated using (public.is_workspace_member(workspace_id));

-- SECURITY DEFINER: lets any authenticated user (and anon, for the unsigned
-- preview) look up an invitation by its token. Returns the workspace name so
-- the accept page can render "You've been invited to {name}".
create or replace function public.invitation_by_token(_token text)
returns table (
  id             uuid,
  workspace_id   uuid,
  workspace_name text,
  invited_email  text,
  role           text,
  created_at     timestamptz,
  expires_at     timestamptz,
  accepted_at    timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select i.id, i.workspace_id, w.name as workspace_name, i.invited_email,
         i.role, i.created_at, i.expires_at, i.accepted_at
  from public.workspace_invitations i
  join public.workspaces w on w.id = i.workspace_id
  where i.token = _token
  limit 1;
$$;

revoke all on function public.invitation_by_token(text) from public;
grant execute on function public.invitation_by_token(text) to authenticated, anon;

-- Accept an invitation. Inserts the caller into workspace_members and marks
-- the invitation accepted. Raises a meaningful error on common failure paths.
create or replace function public.accept_invitation(_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _inv     record;
  _user_id uuid := auth.uid();
begin
  if _user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into _inv from public.workspace_invitations
  where token = _token
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;
  if _inv.accepted_at is not null then
    raise exception 'Invitation already used';
  end if;
  if _inv.expires_at < now() then
    raise exception 'Invitation expired';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (_inv.workspace_id, _user_id, _inv.role)
  on conflict (workspace_id, user_id) do nothing;

  update public.workspace_invitations
  set accepted_at = now(), accepted_by = _user_id
  where id = _inv.id;

  return _inv.workspace_id;
end;
$$;

revoke all on function public.accept_invitation(text) from public;
grant execute on function public.accept_invitation(text) to authenticated;

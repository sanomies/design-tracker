-- 0006_workspace_project_membership.sql
--
-- v1 set up `project_members` separately from `workspace_members`, with the
-- on_project_created trigger only adding the creator. That meant once a
-- second user joined a workspace via invitation, they could see the project
-- list (gated by workspace membership) but every task / comment / attachment
-- inside was hidden (gated by project membership).
--
-- For v1 we align the two: every workspace member is automatically a member
-- of every project in that workspace. Per-project membership remains in the
-- schema as a future hook for finer-grained access.

-- 1) When a new project is created, add EVERY current workspace member as a
--    project member (not just the creator).
create or replace function public.handle_new_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_members (project_id, user_id)
  select new.id, wm.user_id
  from public.workspace_members wm
  where wm.workspace_id = new.workspace_id
  on conflict (project_id, user_id) do nothing;
  return new;
end;
$$;

-- 2) When a user accepts an invitation, add them to every existing project
--    in the workspace (in addition to the workspace_members insert).
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

  -- Also auto-join every existing project in that workspace, so tasks /
  -- comments / attachments RLS doesn't lock the new member out.
  insert into public.project_members (project_id, user_id)
  select p.id, _user_id
  from public.projects p
  where p.workspace_id = _inv.workspace_id
  on conflict (project_id, user_id) do nothing;

  update public.workspace_invitations
  set accepted_at = now(), accepted_by = _user_id
  where id = _inv.id;

  return _inv.workspace_id;
end;
$$;

-- 3) Backfill: for any existing (workspace member, project) pair that isn't
--    already in project_members, add it. Fixes users who joined a workspace
--    before this migration ran.
insert into public.project_members (project_id, user_id)
select p.id, wm.user_id
from public.projects p
join public.workspace_members wm on wm.workspace_id = p.workspace_id
on conflict (project_id, user_id) do nothing;

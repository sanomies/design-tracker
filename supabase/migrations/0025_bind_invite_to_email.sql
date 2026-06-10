-- 0025_bind_invite_to_email.sql — bind invitation acceptance to the invited
-- email address.
--
-- Finding M1 (product decision: switch from "anyone with the link" to
-- email-bound invites). Previously accept_invitation() joined whoever opened a
-- valid link, regardless of which email it was addressed to, so a forwarded /
-- leaked link let any account join the workspace.
--
-- New behavior: if the invitation names an email (invited_email is set), only a
-- user signed in with that exact address may accept. Token-only invites
-- (null/blank email) remain open "anyone with the link". The caller's email is
-- read from auth.users inside this SECURITY DEFINER function (owned by the
-- migration role, which can read the auth schema). This is the authoritative
-- enforcement; the client also pre-checks for a friendly message.
--
-- Body is otherwise identical to the 0006 definition (workspace_members +
-- project_members auto-join, mark accepted).

create or replace function public.accept_invitation(_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _inv          record;
  _user_id      uuid := auth.uid();
  _caller_email text;
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

  -- Email-bound invites: only the addressed user may accept. Token-only
  -- invites (no email) stay open to anyone with the link.
  if _inv.invited_email is not null and _inv.invited_email <> '' then
    select email into _caller_email from auth.users where id = _user_id;
    if _caller_email is null
       or lower(_caller_email) is distinct from lower(_inv.invited_email)
    then
      raise exception 'This invitation was sent to a different email address';
    end if;
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

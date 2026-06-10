-- 0022_fix_membership_self_join.sql — close cross-tenant self-join holes.
--
-- 0002_rls.sql shipped two "defensive" INSERT policies whose WITH CHECK only
-- verifies that the row's user_id equals the caller (user_id = auth.uid()).
-- They never verify that the caller is *allowed* to join the target workspace
-- or project. Because workspace/project UUIDs are not secrets (they appear in
-- invite links, the anon-callable invitation_by_token RPC, ?task= URLs,
-- realtime channels, and notification payloads), any authenticated user could:
--
--   supabase.from('workspace_members').insert({workspace_id, user_id: self, role: 'owner'})
--   supabase.from('project_members').insert({project_id, user_id: self})
--
-- and instantly gain owner/member access to another tenant's data, bypassing
-- the entire invitation token/expiry/single-use flow.
--
-- Every LEGITIMATE membership insert already happens inside a SECURITY DEFINER
-- function that bypasses RLS — handle_new_user() (0003), handle_new_project()
-- (0003/0006) and accept_invitation() (0005/0006) — and the client never
-- inserts these rows directly (it only SELECTs them). So removing the policies
-- closes the hole with no functional change: with no INSERT policy present,
-- RLS default-denies direct inserts from the authenticated/anon roles while
-- the definer functions continue to work.

drop policy if exists "workspace_members_insert_self" on public.workspace_members;
drop policy if exists "project_members_insert_self"   on public.project_members;

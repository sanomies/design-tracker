-- 0035_revoke_anon_function_execute.sql — actually lock the SECURITY DEFINER
-- helper RPCs against anonymous callers.
--
-- ROOT CAUSE: on Supabase, newly created functions are granted EXECUTE to the
-- `anon` (and `authenticated`) role DIRECTLY, via the project's default
-- privileges — not only through PUBLIC. So `revoke ... from public` (as used in
-- 0002, 0031, and 0034) does NOT remove anon's access: anon keeps EXECUTE
-- through its own role grant. Verified live against prod: as anon,
--   POST /rest/v1/rpc/user_is_task_workspace_member  ->  200 (executes)
-- even though 0031 had revoked it from PUBLIC.
--
-- The fix is to revoke from the concrete roles, not just PUBLIC.

-- (1) SECURITY FIX — completes audit-v2 finding E. ------------------------
-- user_is_task_workspace_member(_user_id, _task_id) takes an ARBITRARY
-- _user_id and is SECURITY DEFINER, so for valid UUIDs it answers the real
-- "is this user in this task's workspace?" question, bypassing RLS — a
-- cross-tenant membership oracle when callable by clients. It is invoked ONLY
-- from inside SECURITY DEFINER trigger functions (0008/0009/0023/0029), which
-- execute as the function owner and so are UNAFFECTED by these client-role
-- revokes; it is referenced by no RLS policy and no client code (grep-verified
-- across src/). It therefore should be callable by no client role at all —
-- 0031 intended this but only revoked PUBLIC, which was insufficient.
revoke execute on function public.user_is_task_workspace_member(uuid, uuid)
  from anon, authenticated, public;

-- (2) HYGIENE — lock 0034's project-seen RPCs to authenticated. -----------
-- These are already harmless to anon (both key off auth.uid(), which is null
-- for anon, so they return an empty array / perform no write), but they are
-- meant for signed-in users only and 0034's revoke-from-public left anon able
-- to invoke them. Both are called solely by the authenticated client and are
-- referenced by no RLS policy, so authenticated must keep EXECUTE.
revoke execute on function public.unseen_project_ids()    from anon, public;
revoke execute on function public.mark_project_seen(uuid) from anon, public;
grant  execute on function public.unseen_project_ids()    to authenticated;
grant  execute on function public.mark_project_seen(uuid) to authenticated;

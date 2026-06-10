-- 0026_scope_profiles_select.sql — stop cross-tenant profile enumeration.
--
-- Finding M2: profiles_select_authenticated uses `using (true)`, so any
-- authenticated user (and signup is open) can read EVERY profile across all
-- workspaces — full_name, avatar_url, and email_status (email-delivery state).
-- Raw email addresses live in auth.users, not here, but names + avatars +
-- deliverability status are still cross-tenant PII.
--
-- Fix: a user may read their own profile plus the profiles of anyone who
-- shares at least one workspace with them. The membership lookup runs through
-- a SECURITY DEFINER helper so the profiles policy doesn't recurse into
-- workspace_members' own RLS. No legitimate behavior change: every profile the
-- app displays (members list, assignee picker, mentions, comment authors,
-- notification actors) belongs to a co-member.

create or replace function public.shares_workspace_with(_other_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_members m_self
    join public.workspace_members m_other
      on m_other.workspace_id = m_self.workspace_id
    where m_self.user_id = auth.uid()
      and m_other.user_id = _other_user
  );
$$;

revoke all on function public.shares_workspace_with(uuid) from public;
grant execute on function public.shares_workspace_with(uuid) to authenticated;

drop policy if exists "profiles_select_authenticated" on public.profiles;

create policy "profiles_select_co_members" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.shares_workspace_with(id)
  );

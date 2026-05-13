-- 0002_rls.sql — Enable RLS on every table, define helpers, and write policies.
--
-- The membership helpers are SECURITY DEFINER so they bypass RLS during their
-- own SELECT against *_members. Without that, a policy on `project_members`
-- that calls `is_project_member` would recurse into itself.

-- Helpers ----------------------------------------------------------------
create or replace function public.is_workspace_member(_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = _workspace_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_project_member(_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.project_members
    where project_id = _project_id and user_id = auth.uid()
  );
$$;

-- Resolves a task's project so comments/attachments policies stay short.
create or replace function public.task_project_id(_task_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select project_id from public.tasks where id = _task_id;
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_project_member(uuid)   from public;
revoke all on function public.task_project_id(uuid)     from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_project_member(uuid)   to authenticated;
grant execute on function public.task_project_id(uuid)     to authenticated;

-- Enable RLS -------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects          enable row level security;
alter table public.project_members   enable row level security;
alter table public.tasks             enable row level security;
alter table public.comments          enable row level security;
alter table public.attachments       enable row level security;

-- profiles: everyone authenticated can read; users manage their own row ---
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

create policy "profiles_insert_self" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

create policy "profiles_update_self" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- workspaces -------------------------------------------------------------
create policy "workspaces_select_members" on public.workspaces
  for select to authenticated using (public.is_workspace_member(id));

create policy "workspaces_insert_owner" on public.workspaces
  for insert to authenticated with check (owner_id = auth.uid());

create policy "workspaces_update_owner" on public.workspaces
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "workspaces_delete_owner" on public.workspaces
  for delete to authenticated using (owner_id = auth.uid());

-- workspace_members ------------------------------------------------------
create policy "workspace_members_select_members" on public.workspace_members
  for select to authenticated using (public.is_workspace_member(workspace_id));

-- Inserts in v1 happen only via the signup trigger (SECURITY DEFINER, bypasses RLS).
-- This policy is defensive for the eventual invite flow.
create policy "workspace_members_insert_self" on public.workspace_members
  for insert to authenticated with check (user_id = auth.uid());

-- projects: workspace members can read and mutate ------------------------
create policy "projects_select_workspace_members" on public.projects
  for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "projects_insert_workspace_members" on public.projects
  for insert to authenticated with check (public.is_workspace_member(workspace_id));

create policy "projects_update_workspace_members" on public.projects
  for update to authenticated using (public.is_workspace_member(workspace_id))
                                with check (public.is_workspace_member(workspace_id));

create policy "projects_delete_workspace_members" on public.projects
  for delete to authenticated using (public.is_workspace_member(workspace_id));

-- project_members --------------------------------------------------------
create policy "project_members_select_members" on public.project_members
  for select to authenticated using (public.is_project_member(project_id));

-- App never inserts directly in v1; trigger does it. Defensive policy.
create policy "project_members_insert_self" on public.project_members
  for insert to authenticated with check (user_id = auth.uid());

-- tasks ------------------------------------------------------------------
create policy "tasks_select_member" on public.tasks
  for select to authenticated using (public.is_project_member(project_id));

create policy "tasks_insert_member" on public.tasks
  for insert to authenticated with check (public.is_project_member(project_id));

create policy "tasks_update_member" on public.tasks
  for update to authenticated using (public.is_project_member(project_id))
                                with check (public.is_project_member(project_id));

create policy "tasks_delete_member" on public.tasks
  for delete to authenticated using (public.is_project_member(project_id));

-- comments ---------------------------------------------------------------
create policy "comments_select_member" on public.comments
  for select to authenticated using (public.is_project_member(public.task_project_id(task_id)));

create policy "comments_insert_member" on public.comments
  for insert to authenticated with check (
    author_id = auth.uid()
    and public.is_project_member(public.task_project_id(task_id))
  );

create policy "comments_update_author" on public.comments
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy "comments_delete_author" on public.comments
  for delete to authenticated using (author_id = auth.uid());

-- attachments ------------------------------------------------------------
create policy "attachments_select_member" on public.attachments
  for select to authenticated using (public.is_project_member(public.task_project_id(task_id)));

create policy "attachments_insert_member" on public.attachments
  for insert to authenticated with check (
    uploader_id = auth.uid()
    and public.is_project_member(public.task_project_id(task_id))
  );

create policy "attachments_delete_uploader" on public.attachments
  for delete to authenticated using (uploader_id = auth.uid());

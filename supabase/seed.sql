-- seed.sql — Run this AFTER signing up your first user via the app (or the
-- Supabase Auth dashboard). The signup trigger creates the profile + default
-- workspace; this script populates that workspace with sample projects/tasks.
--
-- Picks the oldest profile so it's deterministic when you have multiple users.

do $$
declare
  _user_id  uuid;
  _ws_id    uuid;
  _proj1    uuid;
  _proj2    uuid;
begin
  select id into _user_id from public.profiles order by created_at asc limit 1;
  if _user_id is null then
    raise exception 'No profile found. Sign up at least one user first.';
  end if;

  select id into _ws_id from public.workspaces where owner_id = _user_id order by created_at asc limit 1;
  if _ws_id is null then
    raise exception 'No workspace found for user %.', _user_id;
  end if;

  insert into public.projects (workspace_id, name, color)
  values (_ws_id, 'Website Redesign', 'indigo')
  returning id into _proj1;

  insert into public.projects (workspace_id, name, color)
  values (_ws_id, 'Q2 Marketing Launch', 'emerald')
  returning id into _proj2;

  -- The on_project_created trigger relies on auth.uid(), which is NULL in the
  -- SQL editor. Insert the membership rows explicitly here.
  insert into public.project_members (project_id, user_id) values
    (_proj1, _user_id),
    (_proj2, _user_id)
  on conflict do nothing;

  insert into public.tasks (project_id, title, status, priority, due_date, position, created_by, assignee_id) values
    (_proj1, 'Audit current site analytics',  'done',        'high',   current_date - 5,  1024, _user_id, _user_id),
    (_proj1, 'Sketch new homepage hero',      'in_progress', 'high',   current_date + 2,  2048, _user_id, _user_id),
    (_proj1, 'Write copy for About page',     'todo',        'medium', current_date + 7,  3072, _user_id, null),
    (_proj1, 'Pick brand color palette',      'todo',        'low',    null,              4096, _user_id, _user_id),
    (_proj1, 'Implement responsive nav',      'todo',        null,     current_date + 14, 5120, _user_id, null);

  insert into public.tasks (project_id, title, status, priority, due_date, position, created_by, assignee_id) values
    (_proj2, 'Draft press release',           'done',        'high',   current_date - 2,  1024, _user_id, _user_id),
    (_proj2, 'Book launch venue',             'in_progress', 'high',   current_date + 5,  2048, _user_id, _user_id),
    (_proj2, 'Coordinate with PR firm',       'in_progress', 'medium', current_date + 10, 3072, _user_id, null),
    (_proj2, 'Design social assets',          'todo',        'medium', current_date + 7,  4096, _user_id, _user_id),
    (_proj2, 'Send invites to press list',    'todo',        'low',    current_date + 12, 5120, _user_id, null);
end $$;

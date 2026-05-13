-- 0003_triggers.sql — Auto-provision profile + default workspace on signup,
-- and auto-add a project creator to project_members.

-- On new auth.user: create profile, default workspace, and owner membership.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _ws_id      uuid;
  _user_name  text;
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

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- On new project: add the creator as a project_member so RLS for tasks works.
-- auth.uid() resolves to the calling user inside the row-level trigger.
create or replace function public.handle_new_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    insert into public.project_members (project_id, user_id)
    values (new.id, auth.uid())
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_project_created on public.projects;
create trigger on_project_created
  after insert on public.projects
  for each row execute function public.handle_new_project();

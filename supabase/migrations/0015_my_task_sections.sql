-- 0015_my_task_sections.sql — personal "My Tasks" sections + per-user
-- ordering on tasks. Each user gets their own list of sections they can
-- create / rename / reorder, and they can drag any task assigned to them
-- into one of their sections regardless of which project the task belongs
-- to.
--
-- my_section_id / my_position live on tasks (single row per task) — they
-- always belong to the CURRENT assignee. When the assignee changes, a
-- trigger clears them so the new assignee starts fresh.

create table public.my_task_sections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  position    double precision not null default 1024,
  created_at  timestamptz not null default now()
);

create index my_task_sections_user_id_position_idx
  on public.my_task_sections(user_id, position);

alter table public.tasks
  add column if not exists my_section_id uuid
  references public.my_task_sections(id) on delete set null;

alter table public.tasks
  add column if not exists my_position double precision;

create index if not exists tasks_my_section_id_idx
  on public.tasks(my_section_id) where my_section_id is not null;

alter table public.my_task_sections enable row level security;

create policy "my_task_sections_select_own" on public.my_task_sections
  for select to authenticated using (user_id = auth.uid());

create policy "my_task_sections_insert_own" on public.my_task_sections
  for insert to authenticated with check (user_id = auth.uid());

create policy "my_task_sections_update_own" on public.my_task_sections
  for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create policy "my_task_sections_delete_own" on public.my_task_sections
  for delete to authenticated using (user_id = auth.uid());

-- Clear per-user sectioning/ordering whenever the assignee changes: the
-- old assignee's preferences would belong to a different user and can't
-- carry over.
create or replace function public.clear_my_task_fields_on_assignee_change()
returns trigger language plpgsql as $$
begin
  if old.assignee_id is distinct from new.assignee_id then
    new.my_section_id := null;
    new.my_position := null;
  end if;
  return new;
end;
$$;

drop trigger if exists clear_my_task_fields_on_assignee_change on public.tasks;
create trigger clear_my_task_fields_on_assignee_change
before update of assignee_id on public.tasks
for each row execute function public.clear_my_task_fields_on_assignee_change();

alter publication supabase_realtime add table public.my_task_sections;

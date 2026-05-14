-- 0011_sections.sql — user-defined task sections (Upcoming / In Progress /
-- whatever) within a project.
--
-- Sections group OPEN tasks. The Done dock at the bottom of the UI is
-- driven by `status = 'done'`, independent of section. A task keeps its
-- section_id while in Done so re-opening returns it to the same section.

create table public.sections (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  name        text not null,
  position    double precision not null default 1024,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id)
);

create index sections_project_id_position_idx
  on public.sections(project_id, position);

-- Tasks now point at a section (nullable). On section delete, tasks fall
-- back to the "no section" group instead of disappearing.
alter table public.tasks
  add column if not exists section_id uuid
  references public.sections(id) on delete set null;

create index if not exists tasks_section_id_idx
  on public.tasks(section_id) where section_id is not null;

alter table public.sections enable row level security;

create policy "sections_select_member" on public.sections
  for select to authenticated using (public.is_project_member(project_id));

create policy "sections_insert_member" on public.sections
  for insert to authenticated with check (
    public.is_project_member(project_id) and created_by = auth.uid()
  );

create policy "sections_update_member" on public.sections
  for update to authenticated
    using (public.is_project_member(project_id))
    with check (public.is_project_member(project_id));

create policy "sections_delete_member" on public.sections
  for delete to authenticated using (public.is_project_member(project_id));

-- Broadcast section changes so clients update live.
alter publication supabase_realtime add table public.sections;

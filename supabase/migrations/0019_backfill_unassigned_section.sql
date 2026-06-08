-- 0019_backfill_unassigned_section.sql — give every existing project that
-- has zero sections an initial "Unassigned" section.
--
-- Going forward, `useCreateProject` (in the client) seeds an "Unassigned"
-- section right after the project insert, so any project created after
-- this migration ships will already have one. This file just closes the
-- gap for projects that were created before that change.
--
-- created_by is left NULL — sections.created_by is nullable and we don't
-- have a reliable "project owner" concept to attribute it to. The
-- existing RLS insert policy (which requires created_by = auth.uid())
-- doesn't apply here because migrations run as postgres / bypass RLS.
--
-- Idempotent: the NOT EXISTS guard means re-running this migration on a
-- database that already has the backfill is a no-op.

insert into public.sections (project_id, name, position, created_by)
select p.id, 'Unassigned', 1024, null
from public.projects p
where not exists (
  select 1 from public.sections s where s.project_id = p.id
);

-- 0016_task_publication.sql — Adds a `publication` slug column to tasks so
-- each task can be tagged with the Delfi-group publication it relates to.
-- The catalog of valid slugs lives in the client (src/features/tasks/
-- publications.ts); the DB only stores the slug string and treats nulls as
-- "no publication".

alter table public.tasks
  add column if not exists publication text;

create index if not exists tasks_publication_idx
  on public.tasks(publication) where publication is not null;

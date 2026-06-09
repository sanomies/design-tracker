-- 0021_task_type.sql — Adds a free-form `type` slug to tasks.
--
-- Used by the detail panel's Type row (and the task list view's Type
-- column) to categorize tasks beyond their section. v1 ships with three
-- presets (kampaania / merch / outdoor) but the column is plain text so
-- new options can be added without another migration.

alter table public.tasks
  add column type text;

create index tasks_type_idx on public.tasks(type) where type is not null;

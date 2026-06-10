-- 0030_pin_task_created_by.sql — make tasks.created_by immutable after insert.
--
-- Finding C (audit v2): tasks_update_member (0002_rls) gates UPDATE only on
-- is_project_member(project_id) with no column-level WITH CHECK, so a project
-- member can UPDATE any task in their project and set created_by = themselves.
-- The 0028 storage-delete policies (task_attachments_delete / task_images_delete)
-- allow deletion when `t.created_by = auth.uid()`, so by claiming authorship of
-- a task a member gains the ability to DELETE other members' uploaded
-- attachments and inline images — defeating the very restriction 0028 added
-- (which was meant to limit deletion to the uploader or the ORIGINAL creator).
-- Forging created_by also misdirects the 'completed' notification (0009) and
-- the comment-creator notification (now gated by 0029) to a chosen recipient.
--
-- Root cause: created_by is meant to be set once, by whoever inserts the task,
-- and never change. RLS cannot express "this column is immutable" (a WITH CHECK
-- clause sees only the new row, not the old), so we pin it with a BEFORE UPDATE
-- trigger.
--
-- Behavior: on UPDATE we silently restore created_by to its prior value rather
-- than raising — the client issues full-row updates in places, and a benign
-- update that happens to echo created_by unchanged must not start failing. The
-- only writes this neutralizes are attempts to CHANGE created_by, which no
-- legitimate flow does. INSERT is intentionally left untouched: created_by is
-- set by the inserting client there and that is the authorship of record;
-- this migration only locks it against later tampering.

create or replace function public.pin_task_created_by()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.created_by is distinct from old.created_by then
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

drop trigger if exists on_task_created_by_pin on public.tasks;
create trigger on_task_created_by_pin
  before update on public.tasks
  for each row execute function public.pin_task_created_by();

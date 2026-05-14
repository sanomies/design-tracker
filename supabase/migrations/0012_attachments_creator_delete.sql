-- 0012_attachments_creator_delete.sql
--
-- Extends attachment delete permissions so the task creator can delete any
-- attachment on their tasks (previously only the uploader could). Required
-- for the "Delete all attachments" bulk action in the task details panel,
-- which is gated to the task creator in the UI.

drop policy if exists "attachments_delete_uploader" on public.attachments;

create policy "attachments_delete_uploader_or_creator" on public.attachments
  for delete to authenticated using (
    uploader_id = auth.uid()
    or exists (
      select 1 from public.tasks t
      where t.id = task_id and t.created_by = auth.uid()
    )
  );

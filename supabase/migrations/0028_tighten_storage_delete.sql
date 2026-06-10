-- 0028_tighten_storage_delete.sql — restrict storage object deletion to the
-- uploader or the task creator.
--
-- Finding M5: the storage delete policies (0004 task_attachments_delete, 0013
-- task_images_delete) gate deletion on project membership alone, so ANY project
-- member could delete (destroy) another member's uploaded file at the storage
-- layer — broader than the attachments table policy (0012), which allows only
-- the uploader or the task creator. This tightens storage to match.
--
-- `owner` on storage.objects is the auth uid that uploaded the object (set by
-- supabase-js uploads, which always carry the user's JWT). The task creator
-- (resolved from the {task_id}/... path prefix) may also delete, preserving the
-- 0012 "creator can clear any attachment on their task" behavior.
--
-- Behavior note: removing an inline image from a SHARED task description you did
-- not upload (and don't own the task) will now leave a storage orphan instead of
-- deleting the object — that path is already best-effort / orphan-tolerant
-- (inlineImageUtils.deleteTaskImageObject), so nothing breaks functionally.

drop policy if exists "task_attachments_delete" on storage.objects;
create policy "task_attachments_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'task-attachments'
    and (
      owner = auth.uid()
      or exists (
        select 1 from public.tasks t
        where t.id = ((storage.foldername(name))[1])::uuid
          and t.created_by = auth.uid()
      )
    )
  );

drop policy if exists "task_images_delete" on storage.objects;
create policy "task_images_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'task-images'
    and (
      owner = auth.uid()
      or exists (
        select 1 from public.tasks t
        where t.id = ((storage.foldername(name))[1])::uuid
          and t.created_by = auth.uid()
      )
    )
  );

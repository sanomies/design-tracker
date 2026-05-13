-- 0004_storage.sql — Private bucket for task attachments.
-- Path convention: `{task_id}/{filename}`. Access is gated by project membership
-- on the task that owns the folder.

insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', false)
on conflict (id) do nothing;

-- storage.foldername(name) returns the path split into an array (1-indexed).
-- The first segment is the task UUID owning the file.

create policy "task_attachments_select" on storage.objects
  for select to authenticated using (
    bucket_id = 'task-attachments'
    and public.is_project_member(public.task_project_id(((storage.foldername(name))[1])::uuid))
  );

create policy "task_attachments_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'task-attachments'
    and public.is_project_member(public.task_project_id(((storage.foldername(name))[1])::uuid))
  );

create policy "task_attachments_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'task-attachments'
    and public.is_project_member(public.task_project_id(((storage.foldername(name))[1])::uuid))
  );

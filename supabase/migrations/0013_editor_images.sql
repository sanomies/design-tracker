-- 0013_editor_images.sql
--
-- Public bucket for images pasted/dropped/picked inside the rich-text editor
-- (task descriptions and comments). Path convention is `{task_id}/{uuid}` so
-- the existing project-membership check can gate inserts/deletes the same way
-- the private attachments bucket does.
--
-- The bucket is `public` so the public URL embedded in the description HTML
-- keeps working without signed-URL refresh. Object names use random UUIDs,
-- so URLs are effectively unguessable.

insert into storage.buckets (id, name, public)
values ('task-images', 'task-images', true)
on conflict (id) do update set public = excluded.public;

create policy "task_images_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'task-images'
    and public.is_project_member(public.task_project_id(((storage.foldername(name))[1])::uuid))
  );

create policy "task_images_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'task-images'
    and public.is_project_member(public.task_project_id(((storage.foldername(name))[1])::uuid))
  );

-- 0024_comments_update_membership_check.sql — stop a comment author from
-- relocating their comment into another tenant's task.
--
-- Finding (Low): comments_update_author's WITH CHECK validates only
-- author_id = auth.uid(), not membership of the (possibly new) task. So an
-- author could UPDATE their own comment's task_id to a task in a project they
-- don't belong to, injecting a comment row into another tenant's task.
--
-- Fix: re-check project membership of the row's task_id in WITH CHECK. No
-- legitimate behavior change — the client only ever edits a comment's body,
-- never moves it between tasks, and an editor of a comment is by definition a
-- member of that comment's project.

drop policy if exists "comments_update_author" on public.comments;

create policy "comments_update_author" on public.comments
  for update to authenticated
  using (author_id = auth.uid())
  with check (
    author_id = auth.uid()
    and public.is_project_member(public.task_project_id(task_id))
  );

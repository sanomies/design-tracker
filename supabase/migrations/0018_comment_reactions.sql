-- 0018_comment_reactions.sql — emoji reactions on task comments.
--
-- Each row is a single user reacting with a single emoji to a single
-- comment. Uniqueness on (comment_id, user_id, emoji) keeps toggling
-- idempotent: clients send an INSERT to "add" and a DELETE to "remove"
-- a reaction, without needing to read state first.

create table public.comment_reactions (
  id          uuid primary key default gen_random_uuid(),
  comment_id  uuid not null references public.comments(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  unique (comment_id, user_id, emoji)
);

create index comment_reactions_comment_id_idx
  on public.comment_reactions(comment_id);

alter table public.comment_reactions enable row level security;

-- Members of the project (where the comment lives) can read all reactions
-- on its comments. The two-step hop (comment → task → project) reuses the
-- existing helper functions.
create policy "comment_reactions_select_member" on public.comment_reactions
  for select to authenticated using (
    public.is_project_member(
      public.task_project_id(
        (select task_id from public.comments where id = comment_id)
      )
    )
  );

-- Only the reacting user themselves can insert their own reaction, and
-- only if they're a project member.
create policy "comment_reactions_insert_self" on public.comment_reactions
  for insert to authenticated with check (
    user_id = auth.uid()
    and public.is_project_member(
      public.task_project_id(
        (select task_id from public.comments where id = comment_id)
      )
    )
  );

-- Only the reacting user can remove their own reaction.
create policy "comment_reactions_delete_self" on public.comment_reactions
  for delete to authenticated using (user_id = auth.uid());

-- Broadcast inserts/deletes so all open clients update live.
alter publication supabase_realtime add table public.comment_reactions;

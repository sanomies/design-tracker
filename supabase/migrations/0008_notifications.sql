-- 0008_notifications.sql — in-app notifications.
--
-- Notifications are created server-side via triggers so they fire regardless
-- of which client made the change (and inside the same transaction).
--
-- Types:
--   mention   — your @-mention chip appears in a comment
--   comment   — someone commented on a task you're assigned to
--   assigned  — someone assigned a task to you (insert or update)

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id     uuid references public.profiles(id) on delete set null,
  type         text not null check (type in ('mention', 'comment', 'assigned')),
  task_id      uuid references public.tasks(id) on delete cascade,
  comment_id   uuid references public.comments(id) on delete cascade,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index notifications_recipient_created_idx
  on public.notifications(recipient_id, created_at desc);

create index notifications_recipient_unread_idx
  on public.notifications(recipient_id) where read_at is null;

alter table public.notifications enable row level security;

-- Users only see / modify their own notifications. No INSERT policy — rows
-- are only created by SECURITY DEFINER triggers below.
create policy "notifications_select_own" on public.notifications
  for select to authenticated using (recipient_id = auth.uid());

create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create policy "notifications_delete_own" on public.notifications
  for delete to authenticated using (recipient_id = auth.uid());

-- Helper: is the given user a member of the workspace that owns this task?
-- Used to suppress notifications for users who aren't actually in the
-- workspace (defensive against forged mention chips).
create or replace function public.user_is_task_workspace_member(_user_id uuid, _task_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.tasks t
    join public.projects p on p.id = t.project_id
    join public.workspace_members wm on wm.workspace_id = p.workspace_id
    where t.id = _task_id and wm.user_id = _user_id
  );
$$;

-- Trigger: on new comment, fan out mention + comment notifications.
create or replace function public.handle_new_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _mentioned_id  uuid;
  _assignee_id   uuid;
  _mentioned_set uuid[] := '{}';
begin
  -- Pull mention UUIDs out of the stored HTML. The mention extension emits
  -- `data-id="<uuid>"` so a simple regex is enough.
  for _mentioned_id in
    select distinct (m[1])::uuid
    from regexp_matches(coalesce(new.body, ''), 'data-id="([0-9a-f-]{36})"', 'g') as m
  loop
    -- Don't notify yourself.
    if new.author_id is not null and _mentioned_id = new.author_id then
      continue;
    end if;
    -- Defensive: only notify users who are actually workspace members.
    if not public.user_is_task_workspace_member(_mentioned_id, new.task_id) then
      continue;
    end if;
    insert into public.notifications (recipient_id, actor_id, type, task_id, comment_id)
    values (_mentioned_id, new.author_id, 'mention', new.task_id, new.id);
    _mentioned_set := array_append(_mentioned_set, _mentioned_id);
  end loop;

  -- Also notify the task's assignee (unless they're the author or already
  -- received a mention notification for this comment).
  select assignee_id into _assignee_id from public.tasks where id = new.task_id;
  if _assignee_id is not null
     and _assignee_id <> coalesce(new.author_id, '00000000-0000-0000-0000-000000000000'::uuid)
     and not (_assignee_id = any(_mentioned_set))
  then
    insert into public.notifications (recipient_id, actor_id, type, task_id, comment_id)
    values (_assignee_id, new.author_id, 'comment', new.task_id, new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists on_comment_created on public.comments;
create trigger on_comment_created
  after insert on public.comments
  for each row execute function public.handle_new_comment();

-- Trigger: on task assignment (INSERT with assignee or UPDATE changing it),
-- notify the new assignee. Skips self-assignment.
create or replace function public.handle_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _actor uuid := coalesce(auth.uid(), new.created_by);
begin
  if new.assignee_id is null then
    return new;
  end if;

  -- UPDATE: only fire when assignee actually changed.
  if tg_op = 'UPDATE'
     and old.assignee_id is not distinct from new.assignee_id then
    return new;
  end if;

  -- Don't notify yourself.
  if new.assignee_id = _actor then
    return new;
  end if;

  insert into public.notifications (recipient_id, actor_id, type, task_id)
  values (new.assignee_id, _actor, 'assigned', new.id);

  return new;
end;
$$;

drop trigger if exists on_task_assignment on public.tasks;
create trigger on_task_assignment
  after insert or update of assignee_id on public.tasks
  for each row execute function public.handle_task_assignment();

-- Broadcast notification changes so clients can update the unread badge live.
alter publication supabase_realtime add table public.notifications;

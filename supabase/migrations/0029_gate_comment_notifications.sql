-- 0029_gate_comment_notifications.sql — stop the comment trigger from
-- notifying / emailing users who aren't in the task's workspace.
--
-- Finding A (audit v2): the twin of M4/0023, left open on the comment path.
-- handle_new_comment (0009) gates only its MENTION loop behind
-- public.user_is_task_workspace_member(); the comment-type inserts to the
-- task assignee, the task creator, and prior thread participants have NO
-- membership check. Because tasks_insert/update (0002_rls) gate only on
-- is_project_member(project_id) with no column-level constraint, an
-- authenticated user can set assignee_id / created_by on a task in their OWN
-- project to ANY profile id (even one in another workspace). Posting a comment
-- then inserts a 'comment' notification for that user with no gate — which
-- handle_notification_email (0017) turns into a real Resend email. Repeated,
-- this is a spam/phishing relay with an attacker-controlled actor name and
-- task title, identical in impact to the assignment vector 0023 closed.
--
-- Fix: gate each comment-type insert behind user_is_task_workspace_member(),
-- exactly like the mention loop already does. No legitimate behavior changes:
-- the assignee picker only offers workspace members, the creator is whoever
-- made the task in-workspace, and prior participants commented from within the
-- workspace — so every real recipient passes the gate. Gating the notification
-- row also gates the email (0017 fires off the notification insert).
--
-- Note: forging created_by also underpins a separate storage-delete escalation
-- (audit v2 finding C) — that is addressed independently by pinning created_by
-- in its own migration, not here. This migration only closes the notification
-- relay.

create or replace function public.handle_new_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _mentioned_id   uuid;
  _task           record;
  _participant_id uuid;
  _notified_set   uuid[] := '{}';
  _author         uuid := coalesce(new.author_id, '00000000-0000-0000-0000-000000000000'::uuid);
begin
  select * into _task from public.tasks where id = new.task_id;

  -- 1) Mention notifications from the comment body. (Already gated.)
  for _mentioned_id in
    select distinct (m[1])::uuid
    from regexp_matches(coalesce(new.body, ''), 'data-id="([0-9a-f-]{36})"', 'g') as m
  loop
    if _mentioned_id = _author then continue; end if;
    if not public.user_is_task_workspace_member(_mentioned_id, new.task_id) then
      continue;
    end if;
    if _mentioned_id = any(_notified_set) then continue; end if;
    insert into public.notifications (recipient_id, actor_id, type, task_id, comment_id)
    values (_mentioned_id, new.author_id, 'mention', new.task_id, new.id);
    _notified_set := array_append(_notified_set, _mentioned_id);
  end loop;

  -- 2) Notify the task assignee — only if a workspace member.
  if _task.assignee_id is not null
     and _task.assignee_id <> _author
     and not (_task.assignee_id = any(_notified_set))
     and public.user_is_task_workspace_member(_task.assignee_id, new.task_id)
  then
    insert into public.notifications (recipient_id, actor_id, type, task_id, comment_id)
    values (_task.assignee_id, new.author_id, 'comment', new.task_id, new.id);
    _notified_set := array_append(_notified_set, _task.assignee_id);
  end if;

  -- 3) Notify the task creator — only if a workspace member.
  if _task.created_by is not null
     and _task.created_by <> _author
     and not (_task.created_by = any(_notified_set))
     and public.user_is_task_workspace_member(_task.created_by, new.task_id)
  then
    insert into public.notifications (recipient_id, actor_id, type, task_id, comment_id)
    values (_task.created_by, new.author_id, 'comment', new.task_id, new.id);
    _notified_set := array_append(_notified_set, _task.created_by);
  end if;

  -- 4) Notify previous commenters on this task (thread reply) — members only.
  for _participant_id in
    select distinct author_id
    from public.comments
    where task_id = new.task_id
      and id <> new.id
      and author_id is not null
  loop
    if _participant_id = _author then continue; end if;
    if _participant_id = any(_notified_set) then continue; end if;
    if not public.user_is_task_workspace_member(_participant_id, new.task_id) then
      continue;
    end if;
    insert into public.notifications (recipient_id, actor_id, type, task_id, comment_id)
    values (_participant_id, new.author_id, 'comment', new.task_id, new.id);
    _notified_set := array_append(_notified_set, _participant_id);
  end loop;

  return new;
end;
$$;

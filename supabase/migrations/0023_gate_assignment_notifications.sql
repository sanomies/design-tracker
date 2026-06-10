-- 0023_gate_assignment_notifications.sql — stop the assignment trigger from
-- notifying / emailing users who aren't in the task's workspace.
--
-- Finding M4: tasks.assignee_id has no membership constraint and profiles are
-- (currently) globally readable, so a user could create a task in their own
-- project, set assignee_id to ANY user id (even in another workspace), and the
-- handle_task_assignment trigger would insert an 'assigned' notification —
-- which handle_notification_email (0017) then turns into a real Resend email.
-- Repeated, this is a spam/phishing relay with an attacker-controlled actor
-- name and task title.
--
-- Fix: gate both the 'assigned' and 'unassigned' notification inserts behind
-- public.user_is_task_workspace_member(), exactly like the mention/description
-- triggers (0008/0009) already do. No legitimate behavior changes: the assignee
-- picker only ever offers workspace members, so real assignees always pass the
-- gate. Gating the notification row also gates the email (0017 fires off the
-- notification insert).

create or replace function public.handle_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _actor uuid := coalesce(auth.uid(), new.created_by);
begin
  -- UPDATE only: if old assignee was set and is now different (or null),
  -- notify them they were unassigned. Skip self-actions and non-members.
  if tg_op = 'UPDATE'
     and old.assignee_id is not null
     and old.assignee_id is distinct from new.assignee_id
     and old.assignee_id <> _actor
     and public.user_is_task_workspace_member(old.assignee_id, new.id)
  then
    insert into public.notifications (recipient_id, actor_id, type, task_id)
    values (old.assignee_id, _actor, 'unassigned', new.id);
  end if;

  -- Existing: notify new assignee.
  if new.assignee_id is null then return new; end if;
  if tg_op = 'UPDATE'
     and old.assignee_id is not distinct from new.assignee_id
  then
    return new;
  end if;
  if new.assignee_id = _actor then return new; end if;

  -- Defensive: only notify a new assignee who is actually a workspace member.
  if not public.user_is_task_workspace_member(new.assignee_id, new.id) then
    return new;
  end if;

  insert into public.notifications (recipient_id, actor_id, type, task_id)
  values (new.assignee_id, _actor, 'assigned', new.id);

  return new;
end;
$$;

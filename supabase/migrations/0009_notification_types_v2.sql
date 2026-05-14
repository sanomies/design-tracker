-- 0009_notification_types_v2.sql
--
-- Adds 4 new notification types and extends existing triggers to cover the
-- larger surface:
--   unassigned       — your task assignment was removed or reassigned
--   completed        — a task you created was marked done
--   deleted          — a task you were assigned to was deleted
--   invite_accepted  — an invite you sent was accepted
--
-- Also extends `handle_new_comment` to notify task creator + previous
-- thread participants (deduped), and adds description-mention scanning.
--
-- Adds a `data jsonb` column for cases where we need to preserve info that
-- would otherwise be lost (e.g., task title for delete notifications, since
-- `task_id` would cascade-delete the row).

-- 1. Schema changes -----------------------------------------------------

alter table public.notifications add column if not exists data jsonb;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'mention', 'comment', 'assigned',
    'unassigned', 'completed', 'deleted', 'invite_accepted'
  ));

-- 2. handle_task_assignment: now also fires `unassigned` on the old --
--    assignee when the assignment changes away from them. ---------------

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
  -- notify them they were unassigned. Skip self-actions.
  if tg_op = 'UPDATE'
     and old.assignee_id is not null
     and old.assignee_id is distinct from new.assignee_id
     and old.assignee_id <> _actor
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

  insert into public.notifications (recipient_id, actor_id, type, task_id)
  values (new.assignee_id, _actor, 'assigned', new.id);

  return new;
end;
$$;

-- 3. Description mentions trigger -------------------------------------
--
-- Scans the task description for `data-id="<uuid>"` chips and notifies
-- each mentioned member. Fires on INSERT or UPDATE of description.

create or replace function public.handle_task_description()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _mentioned_id uuid;
  _actor uuid := coalesce(auth.uid(), new.created_by);
begin
  if tg_op = 'UPDATE'
     and old.description is not distinct from new.description
  then
    return new;
  end if;
  if new.description is null or new.description = '' then
    return new;
  end if;

  for _mentioned_id in
    select distinct (m[1])::uuid
    from regexp_matches(new.description, 'data-id="([0-9a-f-]{36})"', 'g') as m
  loop
    if _actor is not null and _mentioned_id = _actor then continue; end if;
    if not public.user_is_task_workspace_member(_mentioned_id, new.id) then
      continue;
    end if;
    -- Avoid duplicate spam if the description is edited repeatedly.
    if exists (
      select 1 from public.notifications
      where recipient_id = _mentioned_id
        and type = 'mention'
        and task_id = new.id
        and comment_id is null
        and created_at > now() - interval '5 minutes'
    ) then
      continue;
    end if;
    insert into public.notifications (recipient_id, actor_id, type, task_id)
    values (_mentioned_id, _actor, 'mention', new.id);
  end loop;

  return new;
end;
$$;

drop trigger if exists on_task_description on public.tasks;
create trigger on_task_description
  after insert or update of description on public.tasks
  for each row execute function public.handle_task_description();

-- 4. handle_new_comment: now also notifies creator + previous commenters
--    (deduped — each user gets at most one notification per comment, with
--    mention > assignee > creator > thread-reply precedence). ------------

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

  -- 1) Mention notifications from the comment body.
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

  -- 2) Notify the task assignee.
  if _task.assignee_id is not null
     and _task.assignee_id <> _author
     and not (_task.assignee_id = any(_notified_set))
  then
    insert into public.notifications (recipient_id, actor_id, type, task_id, comment_id)
    values (_task.assignee_id, new.author_id, 'comment', new.task_id, new.id);
    _notified_set := array_append(_notified_set, _task.assignee_id);
  end if;

  -- 3) Notify the task creator (if different from the above).
  if _task.created_by is not null
     and _task.created_by <> _author
     and not (_task.created_by = any(_notified_set))
  then
    insert into public.notifications (recipient_id, actor_id, type, task_id, comment_id)
    values (_task.created_by, new.author_id, 'comment', new.task_id, new.id);
    _notified_set := array_append(_notified_set, _task.created_by);
  end if;

  -- 4) Notify previous commenters on this task (thread reply).
  for _participant_id in
    select distinct author_id
    from public.comments
    where task_id = new.task_id
      and id <> new.id
      and author_id is not null
  loop
    if _participant_id = _author then continue; end if;
    if _participant_id = any(_notified_set) then continue; end if;
    insert into public.notifications (recipient_id, actor_id, type, task_id, comment_id)
    values (_participant_id, new.author_id, 'comment', new.task_id, new.id);
    _notified_set := array_append(_notified_set, _participant_id);
  end loop;

  return new;
end;
$$;

-- 5. Task completed trigger ------------------------------------------

create or replace function public.handle_task_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _actor uuid := auth.uid();
begin
  if old.status is not distinct from new.status then return new; end if;
  if new.status <> 'done' then return new; end if;
  if new.created_by is null then return new; end if;
  if new.created_by = _actor then return new; end if;

  insert into public.notifications (recipient_id, actor_id, type, task_id)
  values (new.created_by, _actor, 'completed', new.id);

  return new;
end;
$$;

drop trigger if exists on_task_completed on public.tasks;
create trigger on_task_completed
  after update of status on public.tasks
  for each row execute function public.handle_task_completed();

-- 6. Task deleted trigger --------------------------------------------
--
-- BEFORE DELETE so we can read the row. Doesn't set task_id (it would
-- cascade-delete the notification we just made). Stashes the title in
-- `data` so the inbox can still show "Y deleted '<title>'".

create or replace function public.handle_task_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _actor uuid := auth.uid();
begin
  if old.assignee_id is null then return old; end if;
  if old.assignee_id = _actor then return old; end if;

  insert into public.notifications (recipient_id, actor_id, type, data)
  values (
    old.assignee_id,
    _actor,
    'deleted',
    jsonb_build_object('task_title', old.title)
  );

  return old;
end;
$$;

drop trigger if exists on_task_deleted on public.tasks;
create trigger on_task_deleted
  before delete on public.tasks
  for each row execute function public.handle_task_deleted();

-- 7. Invitation accepted trigger --------------------------------------

create or replace function public.handle_invitation_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _ws_name text;
begin
  if old.accepted_at is not null then return new; end if;     -- was already accepted
  if new.accepted_at is null then return new; end if;          -- not being accepted
  if new.created_by is null then return new; end if;           -- no inviter
  if new.created_by = new.accepted_by then return new; end if; -- self-accepted

  select name into _ws_name from public.workspaces where id = new.workspace_id;

  insert into public.notifications (recipient_id, actor_id, type, data)
  values (
    new.created_by,
    new.accepted_by,
    'invite_accepted',
    jsonb_build_object(
      'workspace_id', new.workspace_id,
      'workspace_name', _ws_name,
      'invited_email', new.invited_email
    )
  );

  return new;
end;
$$;

drop trigger if exists on_invitation_accepted on public.workspace_invitations;
create trigger on_invitation_accepted
  after update of accepted_at on public.workspace_invitations
  for each row execute function public.handle_invitation_accepted();

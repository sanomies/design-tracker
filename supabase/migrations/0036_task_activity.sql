-- 0036_task_activity.sql — Asana-style activity feed for tasks.
--
-- A SECURITY DEFINER trigger on tasks diffs OLD vs NEW on every insert/update
-- and writes one task_activity row per changed field (actor = the acting user).
-- The task detail panel interleaves these rows with comments chronologically.
--
-- Same forge-proof pattern as the notification triggers (0008/0023/0029): the
-- client just performs normal task updates; it can NOT write task_activity
-- directly — there is no insert/update/delete policy, so only the definer
-- trigger writes, and rows are immutable thereafter.

-- Table ------------------------------------------------------------------
create table public.task_activity (
  id         uuid        primary key default gen_random_uuid(),
  task_id    uuid        not null references public.tasks(id) on delete cascade,
  actor_id   uuid        references public.profiles(id) on delete set null,
  type       text        not null,
  data       jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index task_activity_task_idx on public.task_activity(task_id, created_at);

alter table public.task_activity enable row level security;

-- Project members can read a task's activity (mirrors comments_select_member).
-- No insert/update/delete policy on purpose: rows are written only by the
-- definer trigger below and never edited; cascade-on-delete handles cleanup.
create policy "task_activity_select_member" on public.task_activity
  for select to authenticated
  using (public.is_project_member(public.task_project_id(task_id)));

-- Trigger ----------------------------------------------------------------
-- Actor = coalesce(auth.uid(), new.created_by), same as the notification
-- triggers, so it attributes normal authenticated edits correctly. Only
-- user-facing fields are logged; position / my_position / my_section_id are
-- ignored as UI-state noise. Section and assignee changes store the
-- human-readable NAME snapshot so the entry still reads correctly after a
-- section is renamed/deleted or a member leaves the workspace.
create or replace function public.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _actor uuid := coalesce(auth.uid(), new.created_by);
begin
  if tg_op = 'INSERT' then
    insert into public.task_activity (task_id, actor_id, type, data)
    values (new.id, _actor, 'created', '{}'::jsonb);
    return new;
  end if;

  if new.title is distinct from old.title then
    insert into public.task_activity (task_id, actor_id, type, data)
    values (new.id, _actor, 'title_changed',
            jsonb_build_object('from', old.title, 'to', new.title));
  end if;

  if new.description is distinct from old.description then
    insert into public.task_activity (task_id, actor_id, type, data)
    values (new.id, _actor, 'description_changed', '{}'::jsonb);
  end if;

  if new.due_date is distinct from old.due_date then
    insert into public.task_activity (task_id, actor_id, type, data)
    values (new.id, _actor, 'due_date_changed',
            jsonb_build_object('from', old.due_date, 'to', new.due_date));
  end if;

  if new.status is distinct from old.status then
    insert into public.task_activity (task_id, actor_id, type, data)
    values (new.id, _actor, 'status_changed',
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;

  if new.section_id is distinct from old.section_id then
    insert into public.task_activity (task_id, actor_id, type, data)
    values (new.id, _actor, 'section_moved',
            jsonb_build_object(
              'from_name', (select name from public.sections where id = old.section_id),
              'to_name',   (select name from public.sections where id = new.section_id)));
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    insert into public.task_activity (task_id, actor_id, type, data)
    values (new.id, _actor, 'assignee_changed',
            jsonb_build_object(
              'from_name', (select full_name from public.profiles where id = old.assignee_id),
              'to_name',   (select full_name from public.profiles where id = new.assignee_id)));
  end if;

  if new.priority is distinct from old.priority then
    insert into public.task_activity (task_id, actor_id, type, data)
    values (new.id, _actor, 'priority_changed',
            jsonb_build_object('from', old.priority, 'to', new.priority));
  end if;

  return new;
end;
$$;

drop trigger if exists on_task_activity on public.tasks;
create trigger on_task_activity
  after insert or update on public.tasks
  for each row execute function public.log_task_activity();

-- Live updates in the open task panel, same as comments.
alter publication supabase_realtime add table public.task_activity;

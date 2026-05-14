-- 0010_task_completed_at.sql — stamp tasks with when they were completed so
-- the UI can sort the Done section by completion time (instead of creation
-- time). Backfills existing done rows with their created_at as the best
-- available approximation.

alter table public.tasks add column if not exists completed_at timestamptz;

-- Backfill: any task already marked done gets its created_at as a stand-in.
update public.tasks
   set completed_at = created_at
 where status = 'done' and completed_at is null;

-- BEFORE INSERT/UPDATE of status: keeps completed_at consistent with status.
-- Not SECURITY DEFINER — it only writes to NEW, which uses the caller's
-- privileges and is gated by RLS already.
create or replace function public.handle_task_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' then
    -- Stamp when transitioning to done (or inserting as done) and the
    -- caller didn't supply their own completed_at.
    if (tg_op = 'INSERT' or old.status is distinct from new.status)
       and new.completed_at is null
    then
      new.completed_at := now();
    end if;
  elsif tg_op = 'UPDATE' and old.status = 'done' then
    -- Reopening a done task: clear the stamp.
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists on_task_completed_at on public.tasks;
create trigger on_task_completed_at
  before insert or update of status on public.tasks
  for each row execute function public.handle_task_completed_at();

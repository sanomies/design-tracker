-- 0034_project_seen.sql — per-user "last seen" timestamp per project, powering
-- the sidebar's small "unseen tasks" dot.
--
-- A project shows a dot when it contains at least one task that was created
-- AFTER the current user last opened that project, and that the user did not
-- create themselves. Opening the project upserts last_seen_at = now(), which
-- clears the dot.
--
-- Purely additive: one new table + two SECURITY DEFINER RPCs. No change to
-- existing tables, policies, or triggers — so it has no effect on any current
-- flow until the frontend starts calling the RPCs.

-- Table ------------------------------------------------------------------
create table public.project_seen (
  project_id   uuid        not null references public.projects(id) on delete cascade,
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

-- The PK covers lookups by (project_id, user_id); this covers the RPCs'
-- per-user scans.
create index project_seen_user_idx on public.project_seen(user_id);

alter table public.project_seen enable row level security;

-- Own-row-only access (mirrors the notifications model). Writes normally go
-- through mark_project_seen() below, but these policies let the client read
-- its own state and keep any direct upsert safe.
create policy "project_seen_select_own" on public.project_seen
  for select to authenticated using (user_id = auth.uid());

create policy "project_seen_insert_own" on public.project_seen
  for insert to authenticated with check (user_id = auth.uid());

create policy "project_seen_update_own" on public.project_seen
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Mark a project seen ----------------------------------------------------
-- SECURITY DEFINER so the client can't forge user_id or a seen time for
-- someone else — the row is always (this project, the caller, now()). Guarded
-- by is_project_member so it can't seed state for projects the caller can't
-- see. VOLATILE (the sql default) because it writes.
create or replace function public.mark_project_seen(_project_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.project_seen (project_id, user_id, last_seen_at)
  select _project_id, auth.uid(), now()
  where public.is_project_member(_project_id)
  on conflict (project_id, user_id) do update set last_seen_at = excluded.last_seen_at;
$$;

-- Which of the caller's projects have unseen tasks -----------------------
-- Returns the project ids (across all of the caller's projects) that contain
-- at least one task created after the caller last saw the project and not
-- created by the caller. The baseline for a project the caller has never
-- explicitly opened is when they joined it (project_members.created_at), so a
-- freshly added member isn't flooded with every pre-existing task as "unseen".
--
-- Returns a single uuid[] (not SETOF) so PostgREST serializes it as a plain
-- JSON string array — supabase.rpc(...) then yields `data: string[]` directly,
-- with no per-row object wrapping to unpack.
create or replace function public.unseen_project_ids()
returns uuid[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(array_agg(pm.project_id), '{}'::uuid[])
  from public.project_members pm
  where pm.user_id = auth.uid()
    and exists (
      select 1
      from public.tasks t
      where t.project_id = pm.project_id
        and t.created_by is distinct from auth.uid()
        and t.created_at > coalesce(
          (select ps.last_seen_at
             from public.project_seen ps
            where ps.project_id = pm.project_id
              and ps.user_id = auth.uid()),
          pm.created_at
        )
    );
$$;

-- Drop the default PUBLIC EXECUTE (cf. 0031) — these are only for signed-in
-- users, and both scope strictly to auth.uid(), so anon can never learn
-- anything through them.
revoke all on function public.mark_project_seen(uuid) from public;
revoke all on function public.unseen_project_ids()    from public;
grant execute on function public.mark_project_seen(uuid) to authenticated;
grant execute on function public.unseen_project_ids()    to authenticated;

-- Backfill: mark every existing membership "caught up" as of now, so the
-- feature starts clean — no project lights up on first load and only tasks
-- added AFTER this migration trigger the dot.
insert into public.project_seen (project_id, user_id, last_seen_at)
select pm.project_id, pm.user_id, now()
from public.project_members pm
on conflict (project_id, user_id) do nothing;

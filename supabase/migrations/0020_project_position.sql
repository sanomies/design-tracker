-- 0020_project_position.sql — give projects a sortable order so users
-- can drag-reorder them in the sidebar.
--
-- Pattern matches sections.position: floating-point so reorders compute
-- the new value as the midpoint of the neighbours' positions (O(1)
-- without renumbering). New rows take whatever value the client passes
-- in (the create mutation uses Date.now() so freshly created projects
-- land at the bottom).

alter table public.projects
  add column if not exists position double precision not null default 1024;

-- Backfill existing rows. Each workspace gets a 1024-step monotonic
-- sequence so the existing creation order is preserved as the initial
-- sidebar order. Idempotent: re-running with all rows already at >1024
-- still produces the same final ordering, since row_number() is stable.
update public.projects p
set position = sub.pos
from (
  select id, 1024.0 * row_number() over (
    partition by workspace_id order by created_at, id
  ) as pos
  from public.projects
) sub
where p.id = sub.id;

create index if not exists projects_workspace_id_position_idx
  on public.projects(workspace_id, position);

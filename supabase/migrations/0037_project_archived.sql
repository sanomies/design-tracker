-- 0037_project_archived.sql — let a project be archived so it drops out of
-- the active PROJECTS list in the sidebar and into a collapsible ARCHIVE
-- section, without deleting the project (or its tasks).
--
-- `archived` is a plain per-project boolean, toggled from the Edit Project
-- dialog. No RLS change is needed: projects_update_workspace_members
-- (0002_rls.sql) already lets any workspace member update any column on a
-- project they can see, and the column is not column-restricted anywhere.

alter table public.projects
  add column if not exists archived boolean not null default false;

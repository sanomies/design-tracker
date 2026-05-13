-- 0001_init.sql — Full v1 schema including columns reserved for follow-up features.
-- Tables only here; RLS, triggers, and storage live in later migrations.

create extension if not exists "pgcrypto";

-- profiles ---------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- workspaces -------------------------------------------------------------
create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid not null references public.profiles(id),
  created_at  timestamptz not null default now()
);

create index workspaces_owner_id_idx on public.workspaces(owner_id);

-- workspace_members ------------------------------------------------------
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references public.profiles(id)   on delete cascade,
  role         text not null check (role in ('owner', 'member')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_id_idx on public.workspace_members(user_id);

-- projects ---------------------------------------------------------------
create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  name          text not null,
  color         text not null default 'slate',
  created_at    timestamptz not null default now()
);

create index projects_workspace_id_idx on public.projects(workspace_id);

-- project_members --------------------------------------------------------
create table public.project_members (
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index project_members_user_id_idx on public.project_members(user_id);

-- tasks ------------------------------------------------------------------
-- `position` uses floating-point gaps so reorders are O(1) without renumbering.
create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  parent_task_id  uuid references public.tasks(id) on delete cascade,
  title           text not null,
  description     text,
  assignee_id     uuid references public.profiles(id),
  due_date        date,
  status          text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority        text check (priority in ('low', 'medium', 'high')),
  position        double precision not null default 1024,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id)
);

create index tasks_project_id_idx     on public.tasks(project_id);
create index tasks_parent_task_id_idx on public.tasks(parent_task_id) where parent_task_id is not null;
create index tasks_assignee_id_idx    on public.tasks(assignee_id)    where assignee_id is not null;

-- comments ---------------------------------------------------------------
create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  author_id   uuid references public.profiles(id),
  body        text not null,
  created_at  timestamptz not null default now()
);

create index comments_task_id_idx on public.comments(task_id);

-- attachments ------------------------------------------------------------
create table public.attachments (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.tasks(id) on delete cascade,
  uploader_id   uuid references public.profiles(id),
  file_name     text not null,
  file_size     bigint not null,
  mime_type     text,
  storage_path  text not null,
  created_at    timestamptz not null default now()
);

create index attachments_task_id_idx on public.attachments(task_id);

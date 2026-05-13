# Build: Mini-Asana (v1 scaffold)

I want to build a simplified Asana clone. This first task is to **scaffold the project and ship a working vertical slice**: auth + projects + tasks (no subtasks or attachments yet). Subsequent tasks will add subtasks, attachments, comments, board view, and realtime.

## Stack

- **Vite + React + TypeScript**
- **Tailwind CSS** for styling
- **shadcn/ui** for component primitives (Button, Dialog, Input, Dropdown, etc.)
- **Supabase** for Postgres, Auth, Storage, and (later) Realtime
- **TanStack Query** (`@tanstack/react-query`) for server state
- **React Router** (`react-router-dom`) for routing
- **Zod** for validation of forms and API boundaries

Do NOT add: Redux, Zustand, a CSS-in-JS library, a UI kit beyond shadcn, GraphQL, or an ORM. Use the Supabase JS client directly.

## Project structure

```
src/
  lib/
    supabase.ts          # Supabase client singleton
    queryClient.ts       # TanStack Query config
  types/
    database.ts          # Generated Supabase types (or hand-written for now)
  features/
    auth/                # Sign in, sign up, sign out, auth context
    projects/            # List, create, open project
    tasks/               # List view, task detail panel
  components/ui/         # shadcn components
  components/            # App-level shared components (Layout, Sidebar, etc.)
  routes/                # Route components, thin wrappers around features
  App.tsx
  main.tsx
supabase/
  migrations/            # SQL migration files, numbered
  seed.sql               # Test data
.env.example             # SUPABASE_URL, SUPABASE_ANON_KEY
README.md
```

## Data model (full v1, including future features — set up the schema now)

Create SQL migration files in `supabase/migrations/` for:

```
profiles (id uuid PK refs auth.users, full_name text, avatar_url text, created_at timestamptz)

workspaces (id uuid PK, name text, owner_id uuid refs profiles, created_at timestamptz)

workspace_members (workspace_id uuid, user_id uuid, role text check in ('owner','member'), PK (workspace_id, user_id))

projects (id uuid PK, workspace_id uuid refs workspaces, name text, color text, created_at timestamptz)

project_members (project_id uuid, user_id uuid, PK (project_id, user_id))

tasks (
  id uuid PK,
  project_id uuid refs projects on delete cascade,
  parent_task_id uuid refs tasks on delete cascade nullable,
  title text not null,
  description text,
  assignee_id uuid refs profiles nullable,
  due_date date nullable,
  status text check in ('todo','in_progress','done') default 'todo',
  priority text check in ('low','medium','high') nullable,
  position double precision not null,
  created_at timestamptz,
  created_by uuid refs profiles
)

comments (id uuid PK, task_id uuid refs tasks on delete cascade, author_id uuid refs profiles, body text, created_at timestamptz)

attachments (id uuid PK, task_id uuid refs tasks on delete cascade, uploader_id uuid refs profiles, file_name text, file_size bigint, mime_type text, storage_path text, created_at timestamptz)
```

Create the `task-attachments` Storage bucket (private).

## Row Level Security — required, not optional

Enable RLS on every table. Write policies such that:

- A user can read/write `profiles` for themselves; read others.
- A user can see workspaces they're a member of.
- A user can see projects in workspaces they're a member of.
- A user can read/write tasks, comments, and attachments in projects they're a member of.
- Storage policy on `task-attachments`: user can read/write objects whose path starts with a task ID they have access to (use path convention `{task_id}/{filename}`).

Write a helper SQL function `is_project_member(project_id uuid)` and reuse it across policies to keep them readable.

Auto-create a `profile` row when a new auth user signs up via a trigger on `auth.users`.

Auto-create a default workspace + membership for new users via the same trigger flow.

## What to build in this scaffold (v1 vertical slice)

1. **Auth**
   - Email/password sign up + sign in
   - AuthProvider context that exposes `user`, `session`, `loading`, `signOut`
   - Protected route wrapper that redirects to `/login` if unauthenticated
   - On sign up, ensure the profile + default workspace are created

2. **Layout**
   - Sidebar: workspace name at top, list of projects below, "New project" button, user menu at bottom with sign out
   - Main area: routed content
   - Route structure: `/login`, `/signup`, `/`, `/projects/:projectId`

3. **Projects**
   - Sidebar shows all projects in the user's default workspace
   - "New project" opens a dialog: name + color picker (6 preset colors)
   - Clicking a project navigates to `/projects/:projectId` and shows its tasks
   - Rename and delete project from a dropdown on the project row

4. **Tasks (parent tasks only in this slice — no subtasks yet)**
   - List view inside a project
   - Inline-add at the top: type title, press Enter to create, focus stays so you can keep adding
   - Each row shows: checkbox (toggles done), title, assignee avatar, due date, priority badge
   - Click a row to open a right-side detail panel (slide-in, closes on Esc or backdrop click)
   - Detail panel fields, all inline-editable: title, description (textarea), assignee (dropdown of workspace members), due date (date picker), priority (low/medium/high), status (todo/in_progress/done)
   - Delete task from a dropdown in the detail panel header

5. **Data fetching**
   - Use TanStack Query for all reads
   - Mutations should optimistically update the cache, then invalidate on success
   - Show skeleton loaders, not spinners, while initial data loads

## Non-negotiable details

- **Keyboard:** Enter to submit, Esc to close panels/dialogs, `/` to focus the inline-add input on the task list.
- **No flash of unauthenticated content** on first load — wait for the session to resolve before routing.
- **Empty states** for "no projects yet" and "no tasks yet" with a clear CTA.
- **Errors:** show toast on mutation failure (use shadcn's `sonner` or `toast`), don't silently swallow.
- **Types:** generate or write TypeScript types for the DB. No `any`.
- **Env vars:** read from `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Fail loudly at startup if missing.

## Seed data

`supabase/seed.sql` should create:
- One test user (or document how to create one via Supabase dashboard)
- A default workspace
- 2 projects with different colors
- ~10 tasks across the projects with varied statuses, due dates, priorities

## Deliverables for this task

- Working `npm run dev` that boots the app
- Sign up, sign in, sign out flow working against a real Supabase project
- Can create projects, see them in sidebar, open them
- Can create, edit, complete, delete tasks within a project
- All RLS policies in place and tested (a second user cannot see the first user's data)
- `README.md` with setup steps: create Supabase project, run migrations, set env vars, run dev server

## What NOT to build yet

These come in follow-up tasks — do not build them now even if it feels natural:

- Subtasks
- File attachments
- Comments
- Board (Kanban) view
- Workspace member invites
- Realtime subscriptions
- Search, filters, sort options beyond default
- Notifications
- Mobile-specific layouts (desktop-first is fine)

## How to work

- Before writing code, propose the plan (file list + key decisions) and wait for confirmation.
- Build the migrations first, run them against Supabase, verify RLS with two test users.
- Then scaffold the app and build features in this order: auth → layout → projects → tasks.
- Commit after each working feature so it's easy to roll back.
- If you hit an ambiguity not covered above, ask rather than guess.

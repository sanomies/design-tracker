# Design Tracker

A simplified Asana-style task manager built on Supabase. Vite + React + TypeScript + Tailwind + shadcn/ui on the front, Postgres + Auth + Storage on the back, with RLS doing the access control.

## Stack

- **Vite + React 18 + TypeScript** (strict, `noUncheckedIndexedAccess`)
- **Tailwind CSS** + **shadcn/ui** primitives
- **Supabase** for Postgres, Auth, and Storage
- **TanStack Query** for server state with optimistic mutations
- **React Router v6**, **Zod**, **react-hook-form**
- **TipTap** for the rich-text editor (mentions, slash commands, tables, etc.)
- **DOMPurify** for sanitizing stored HTML on render

---

## Setup

### 1. Create a Supabase project

From <https://supabase.com>, then grab from **Project Settings → API**:
- **Project URL** → `VITE_SUPABASE_URL`
- **anon public** key → `VITE_SUPABASE_ANON_KEY` (new `sb_publishable_…` keys work too)

In **Authentication → URL Configuration**, set **Site URL** to `http://localhost:5173` so confirmation emails redirect to the dev server.

### 2. Run the migrations

In the SQL Editor, run each file in order:

```
supabase/migrations/0001_init.sql      # tables + indexes (incl. columns reserved for subtasks/etc.)
supabase/migrations/0002_rls.sql       # SECURITY DEFINER helpers + RLS policies on every table
supabase/migrations/0003_triggers.sql  # signup trigger: creates profile + default workspace
supabase/migrations/0004_storage.sql   # private task-attachments bucket + path-scoped policies
```

### 3. Env vars

```bash
cp .env.example .env.local
# fill in the values
```

[src/lib/env.ts](src/lib/env.ts) throws at module load if either var is missing.

### 4. Install + run

```bash
npm install
npm run dev
```

Visit <http://localhost:5173>. Sign up, click the confirmation email, sign in.

### 5. (Optional) Seed sample data

After your first user is confirmed, run `supabase/seed.sql` in the SQL Editor. It picks the oldest profile and inserts 2 sample projects + 10 tasks.

---

## What's in v1

### Auth
- Email/password sign-up and sign-in with email confirmation
- Auth context (`user`, `session`, `loading`, `signOut`) — `loading` blocks routing until the first session check resolves, so no flash of unauth content
- Protected route wrapper with skeleton state
- Signup trigger auto-creates the user's profile + default workspace

### Projects
- Sidebar list of all projects in the user's workspace
- New-project dialog: name + 6-color picker (pink/red/orange/yellow/green/teal)
- Rename + delete from per-row dropdown; deletes navigate away if you're viewing the project
- All mutations optimistic with rollback + toast on failure

### Tasks
- List view with inline-add at the top — Enter creates, focus stays so you can keep adding; `/` from anywhere in the project focuses it
- Row shows: checkbox (toggles done ↔ todo), title, priority badge, due date with red/amber/muted tones for past/today/future, assignee avatar
- Click a row → slide-in detail panel (right side, not modal)
- Panel state lives in the URL (`?task=<uuid>`) so refresh keeps it open and browser-back closes it

### Detail panel
- Wide (600 px default), **drag the left edge to resize**, width persisted to localStorage, viewport-clamped
- Drop shadow on left edge, **not a modal** — task list stays visible and clickable
- Esc closes (skipped when any inner dialog/menu is open)
- All fields inline-editable: title (click → input, Enter/blur to save), description (rich-text), assignee (popover with workspace members), due date (calendar popover), priority (todo/in_progress/done), status

### Rich-text editor (description + comments)
- TipTap with markdown input rules (`**bold**`, `1. `, etc.)
- Floating toolbar that **fades in only when the editor is focused**, with: Undo/Redo · Bold/Italic/Underline/Strikethrough · Bulleted/Numbered/Quote · Link/Code/Code block
- **`+` insert menu**: Paragraph, Heading 1/2, lists, quote, code block, table (3×3 w/ header), section break, emoji picker, image URL, mention, embed link
- **`/` slash command** (Notion-style) — same options, filterable as you type (`/h1`, `/table`, `/img`)
- **`@` mention** — popup of workspace members, keyboard-navigable, inserts a styled chip carrying `data-id` so a future notification job can extract mentions
- HTML stored in DB; rendered through DOMPurify with an allowlist

### Comments
- List under each task, oldest → newest, with author name + relative time
- Rich-text composer; **⌘+Enter posts**, plain Enter newlines
- Optimistic add

### Attachments
- Click `+` or the dashed tile to upload — multi-file, 50 MB cap each
- Tile grid: image thumbnails via signed URLs, file-type icon + extension label for everything else
- Per-tile chevron → Download / Delete
- **Click a tile → full-screen lightbox**:
  - Top bar: filename + uploaded date · Download · Close
  - Image preview or fallback card for non-images
  - ← → arrows + keyboard for navigation
  - Bottom thumbnail strip with all attachments; active one rings and auto-scrolls into view
  - Esc closes, body scroll locked while open

### Polish
- Skeletons during initial loads
- Toasts (sonner) on every mutation failure — no silent swallowing
- Empty states for "no projects yet" and "no tasks yet"
- Keyboard: Enter submits forms, Esc closes panels/dialogs, `/` focuses inline-add

---

## Verifying RLS

The two-user check that proves nobody can read across workspaces:

1. Sign up **user A** at `/signup`, confirm via email, sign in. Create a project, add a few tasks.
2. In a different browser or private window, sign up **user B** with a different email (Gmail aliasing works: `you+a@gmail.com`, `you+b@gmail.com`).
3. As B, you should see **only B's empty workspace** in the sidebar — none of A's projects or tasks.
4. Try to forge it in the SQL Editor while signed in as B (DevTools → Network → grab the JWT from a request, or just use the SQL Editor's session):
   ```sql
   select * from public.projects;  -- ZERO of user A's
   select * from public.tasks;     -- ZERO of user A's
   select * from public.workspaces; -- only B's own
   ```
5. Try to fetch one of A's storage objects directly by URL → 403.

If anything leaks, stop and fix RLS before continuing. The policies are in [0002_rls.sql](supabase/migrations/0002_rls.sql) and [0004_storage.sql](supabase/migrations/0004_storage.sql).

---

## Project layout

```
src/
  lib/
    supabase.ts            # typed Supabase client singleton
    queryClient.ts         # TanStack Query config
    env.ts                 # throws at startup if env vars missing
    utils.ts               # cn() helper for shadcn
  hooks/
    useResizablePanel.ts   # drag-to-resize the task detail panel
  types/
    database.ts            # hand-written DB types (swap for `supabase gen types` later)
  components/
    ui/                    # shadcn components
    rich-text/             # TipTap editor + slash menu + mention list + read-only renderer
    AppShell.tsx
    Sidebar.tsx
    ProtectedRoute.tsx
  features/
    auth/                  # AuthProvider, useAuth, login/signup pages, schemas
    workspaces/            # default workspace + members hooks
    projects/              # queries + mutations, new/rename/delete UI, color palette
    tasks/                 # task list, row, detail panel, priority palette
    comments/              # query + mutation, list + composer
    attachments/           # tile grid, lightbox, signed URL helpers
  routes/
    HomeEmpty.tsx
    ProjectView.tsx
  App.tsx
  main.tsx
supabase/
  migrations/              # numbered SQL — run in order
  seed.sql                 # sample data, run after first signup
.env.example
```

---

## Scripts

| Command             | Does                                       |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Vite dev server on `:5173`                 |
| `npm run build`     | Type-check + production build              |
| `npm run preview`   | Serve the production build locally         |
| `npm run typecheck` | TypeScript check, no emit                  |
| `npm run lint`      | ESLint                                     |

---

## What's not in v1 (deferred follow-ups)

The schema already has columns/tables reserved for these — no data-model migrations needed when they land:

- **Subtasks** (`tasks.parent_task_id` exists; the task query filters it out for now)
- **Board (Kanban) view**
- **Workspace member invites** (multi-user collab — needs an invite flow + email)
- **Realtime subscriptions** (postgres_changes on tasks/comments)
- **Notifications** — `@`-mention nodes already carry `data-id`; a worker can scrape them
- **Search / filters / sort** beyond default ordering
- **Mobile-specific layouts** — desktop-first for now
- **Image upload from the rich-text editor's Image dialog** — currently URL-only; same upload pipeline as attachments would slot in
- **Drag-drop file upload** onto the attachments grid
- **Rich link previews** (oembed cards for the `Embed link` insert) — needs a server piece

# Design Tracker

A simplified task manager built on Supabase. Vite + React + TypeScript + Tailwind + shadcn/ui on the front, Postgres + Auth + Storage on the back, with RLS doing the access control.

## Stack

- **Vite + React 18 + TypeScript** (strict, `noUncheckedIndexedAccess`)
- **Tailwind CSS** + **shadcn/ui** primitives
- **Supabase** for Postgres, Auth, Storage, and Realtime
- **TanStack Query** for server state with optimistic mutations
- **React Router v6**, **Zod**, **react-hook-form**
- **TipTap** for the rich-text editor (mentions, slash commands, tables, etc.)
- **DOMPurify** for sanitizing stored HTML on render
- **@dnd-kit** for drag-and-drop (sections, task reordering)
- **Resend** for transactional email (invites, mentions, assignments, replies)

---

## Setup

### 1. Create a Supabase project

From <https://supabase.com>, then grab from **Project Settings → API**:
- **Project URL** → `VITE_SUPABASE_URL`
- **anon public** key → `VITE_SUPABASE_ANON_KEY` (new `sb_publishable_…` keys work too)

In **Authentication → URL Configuration**, set **Site URL** to `http://localhost:5173` so confirmation emails redirect to the dev server.

### 2. Run the migrations

Easiest path — `npx supabase link --project-ref <ref>` then `npx supabase db push`. Or copy each file into the SQL Editor in order:

```
0001_init.sql                          # tables + indexes
0002_rls.sql                           # SECURITY DEFINER helpers + RLS on every table
0003_triggers.sql                      # signup trigger: profile + default workspace
0004_storage.sql                       # task-attachments bucket + path-scoped policies
0005_invitations.sql                   # workspace_invitations table + token flow
0006_workspace_project_membership.sql  # multi-user collab + per-project access
0007_realtime.sql                      # publication wiring for postgres_changes
0008_notifications.sql                 # in-app notification inbox
0009_notification_types_v2.sql         # mention / assigned / comment types
0010_task_completed_at.sql             # timestamp for completion analytics
0011_sections.sql                      # ordered sections within a project
0012_attachments_creator_delete.sql    # creators can delete their own uploads
0013_editor_images.sql                 # task-images bucket (rich-text inline media)
0014_drop_task_views.sql               # removed saved-views experiment
0015_my_task_sections.sql              # personal "My tasks" grouping
0016_task_publication.sql              # publication picker + per-task brand pill
0017_email_notifications.sql           # email queue, prefs, unsubscribe tokens, bounces
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

## What's in the app

### Auth
- Email/password sign-up and sign-in with email confirmation
- Auth context (`user`, `session`, `loading`, `signOut`) — `loading` blocks routing until the first session check resolves, so no flash of unauth content
- Protected route wrapper with skeleton state
- Signup trigger auto-creates the user's profile + default workspace

### Workspaces & invites
- Multi-user workspaces with per-project membership
- Invite by email from the Members dialog — Resend delivers a transactional invite with a tokenized accept URL
- Invitees who already have an account land straight in the workspace; new users are walked through signup and auto-joined
- Per-user role + revocation; pending invites visible and re-sendable

### Projects
- Sidebar list of all projects you can access in the workspace
- New-project dialog: name + 6-color picker (pink/red/orange/yellow/green/teal)
- Rename + delete from per-row dropdown; deletes navigate away if you're viewing the project
- All mutations optimistic with rollback + toast on failure

### Sections
- Each project can be grouped into ordered sections (drag-and-drop reorder via @dnd-kit)
- Tasks live inside a section or in an "uncategorized" bucket
- Inline rename, delete, and add-section affordance at the end of the list

### Tasks
- List view with inline-add per section — Enter creates, focus stays for rapid entry; `/` from anywhere in the project focuses the first inline-add
- Configurable columns (assignee, due date, priority, publication, etc.) — toggle from the list header
- Sort + filter controls in the header (by due date, priority, assignee, completion)
- Row shows: checkbox (toggles done ↔ todo), title, columns you've enabled, drag handle for cross-section reordering
- Click a row → slide-in detail panel (right side, not modal)
- Panel state lives in the URL (`?task=<uuid>`) so refresh keeps it open and browser-back closes it
- **Subtasks**: nest tasks under a parent; the detail panel shows a "Back to parent" breadcrumb and a subtask list with the same inline-add affordance
- **Publications**: tag a task with a brand/publication (Delfi, Tasku, Geenius, etc.) — shown as a colored pill in the panel header and as a column on the list
- Global search (`Cmd/Ctrl+K`) — combobox across every task you can see, with project + section context

### My tasks
- Dedicated route showing every task assigned to you across all projects
- Personal sections (Today / Upcoming / Later / Done) — drag tasks between buckets, order persists per user

### Detail panel
- Wide (600 px default), **drag the left edge to resize**, width persisted to localStorage, viewport-clamped
- Drop shadow on left edge, **not a modal** — task list stays visible and clickable
- Esc closes (skipped when any inner dialog/menu is open)
- All fields inline-editable: title (click → input, Enter/blur to save), description (rich-text), assignee (popover with workspace members), due date (calendar popover), priority, status, publication

### Notifications
- In-app inbox (bell in the sidebar) with unread badge — fed by realtime subscriptions, no polling
- Notification types: assigned to you, @-mentioned in a comment/description, reply on a task you follow
- Click a notification → opens the task panel scrolled to the relevant comment
- Per-user email preferences at `/settings/email` (one toggle per type) with token-based unsubscribe links that work without login
- Bounce + spam-complaint handling: addresses that bounce get flagged and skipped on future sends
- See [EMAIL_SETUP.md](EMAIL_SETUP.md) for the Resend + DNS + secrets walkthrough

### Rich-text editor (description + comments)
- TipTap with markdown input rules (`**bold**`, `1. `, etc.)
- Sticky toolbar at the bottom of the description box with: Undo/Redo · Bold/Italic/Underline/Strikethrough · Bulleted/Numbered/Quote · Link/Code/Code block
- **`+` insert menu**: Paragraph, Heading 1/2, lists, quote, code block, table (3×3 w/ header), section break, emoji picker, image upload/URL, mention, embed link, banner picker
- **`/` slash command** (Notion-style) — same options, filterable as you type (`/h1`, `/table`, `/img`)
- **`@` mention** — popup of workspace members, keyboard-navigable, inserts a styled chip carrying `data-id` that the notification pipeline scrapes to fire mention emails
- **Inline image upload** straight from the toolbar/slash menu — files land in the `task-images` bucket and the editor inserts a `<img>` with the public URL
- **Banner picker** for description headers (publication-themed banner images)
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

### Realtime
- Supabase `postgres_changes` subscriptions on tasks, comments, notifications, sections
- Edits made by other workspace members appear without refresh — including new tasks, status flips, comments, and inbox notifications
- TanStack Query cache is patched in-place so optimistic updates don't fight realtime echoes

### Polish
- Skeletons during initial loads
- Toasts (sonner, bottom-center) on every mutation failure — no silent swallowing
- Empty states for "no projects yet" and "no tasks yet"
- Keyboard: Enter submits forms, Esc closes panels/dialogs, `/` focuses inline-add, `Cmd/Ctrl+K` opens global search

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
    workspaces/            # workspace + members hooks, members dialog
    invites/               # workspace invitation flow (send/accept/revoke)
    projects/              # queries + mutations, new/rename/delete UI, color palette
    sections/              # ordered section blocks, drag-drop, dialogs
    tasks/                 # list, row, detail panel, subtasks, search, sort/filter, publications
    comments/              # query + mutation, list + composer
    attachments/           # tile grid, lightbox, signed URL helpers
    notifications/         # inbox link + realtime hooks
    preferences/           # per-user email notification settings + unsubscribe page
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

## Deployment

The app builds to a static bundle and is wired to deploy to GitHub Pages under the `/design-tracker/` subpath:

```bash
npm run build           # outputs dist/ with BASE_URL=/design-tracker/
```

`vite.config.ts` sets the base, and `src/lib/env.ts` reads `VITE_*` vars at build time. For the live site, GitHub Actions builds on push to `main` and publishes `dist/` to the `gh-pages` branch.

Auth redirect URLs in Supabase need to include both `http://localhost:5173` and the production origin (`https://<user>.github.io/design-tracker/`).

---

## Still on the backlog

- **Board (Kanban) view** — schema-ready, no UI yet
- **Mobile-specific layouts** — desktop-first for now
- **Rich link previews** (oembed cards for the `Embed link` insert) — needs a server piece
- **Drag-drop file upload** onto the attachments grid (Cmd-V multi-file from Finder is blocked by a Chrome/macOS limitation — only one file surfaces)
- **Recurring tasks** and **time tracking**

import {
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Folder,
  LogOut,
  Mail,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  UserCircle2,
  Users,
} from "lucide-react";

import { IconBell, IconCircleCheck, IconSearch } from "@/components/icons/figma";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/features/auth/AuthProvider";
import { useNotifications } from "@/features/notifications/useNotifications";
import { useMyTasks } from "@/features/tasks/useMyTasks";
import { MobileTaskSearchSheet } from "@/features/tasks/MobileTaskSearchSheet";
import { ProjectLetterPill } from "@/features/projects/ProjectRow";
import { EditProjectDialog } from "@/features/projects/EditProjectDialog";
import { NewProjectDialog } from "@/features/projects/NewProjectDialog";
import {
  useDeleteProject,
  useProjects,
} from "@/features/projects/useProjects";
import { useUnseenProjects } from "@/features/projects/useUnseenProjects";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCurrentWorkspaceId } from "@/features/workspaces/CurrentWorkspaceProvider";
import { MembersDialog } from "@/features/workspaces/MembersDialog";
import { useWorkspace, useWorkspaces } from "@/features/workspaces/useWorkspace";
import { avatarColor } from "@/lib/avatarColor";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/database";

type OpenSheet = "projects" | "you" | "search" | null;

export function MobileBottomNav() {
  const [openSheet, setOpenSheet] = useState<OpenSheet>(null);
  const { user } = useAuth();
  const location = useLocation();

  // Close any open sheet on route change so tapping a project inside the
  // Projects sheet lands the user on the project view with the sheet
  // dismissed.
  useEffect(() => {
    setOpenSheet(null);
  }, [location.pathname]);

  const initials = userInitials(user);
  const closeSheet = () => setOpenSheet(null);

  return (
    <>
      <nav
        // z-[60] keeps the bar above the full-screen sheets (Radix overlay
        // + content sit at z-50), so the nav stays visible and tappable
        // while a sheet is open — the active tab signals which sheet it is,
        // and tapping another tab switches/closes per the Figma.
        className="relative shrink-0 z-[60] bg-white border-t border-[#DEDFE0] pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        <div className="flex h-14">
          <NavTab to="/inbox" onClick={closeSheet}>
            {({ isActive }) => (
              <>
                <InboxTabIcon active={isActive} />
                <NavLabel>Inbox</NavLabel>
              </>
            )}
          </NavTab>
          <NavTab to="/my-tasks" onClick={closeSheet}>
            {({ isActive }) => (
              <>
                <TasksTabIcon active={isActive} />
                <NavLabel>My Tasks</NavLabel>
              </>
            )}
          </NavTab>
          <SheetTabButton
            active={openSheet === "projects"}
            onClick={() => setOpenSheet("projects")}
            aria-label="Projects"
          >
            <Folder
              className="h-6 w-6"
              strokeWidth={openSheet === "projects" ? 2.25 : 1.75}
              fill={openSheet === "projects" ? "currentColor" : "none"}
            />
            <NavLabel>Projects</NavLabel>
          </SheetTabButton>
          <SheetTabButton
            active={openSheet === "search"}
            onClick={() => setOpenSheet("search")}
            aria-label="Search"
          >
            <IconSearch
              className="h-6 w-6"
              strokeWidth={openSheet === "search" ? 2.5 : 2}
            />
            <NavLabel>Search</NavLabel>
          </SheetTabButton>
          <SheetTabButton
            active={openSheet === "you"}
            onClick={() => setOpenSheet("you")}
            aria-label="Account"
          >
            <Avatar
              className={cn(
                "h-6 w-6 transition-shadow",
                openSheet === "you" &&
                  "ring-2 ring-foreground ring-offset-2 ring-offset-white"
              )}
            >
              <AvatarFallback
                className={cn("text-[10px] font-bold", avatarColor(user?.id))}
              >
                {initials || "?"}
              </AvatarFallback>
            </Avatar>
            <NavLabel>You</NavLabel>
          </SheetTabButton>
        </div>
      </nav>

      <MobileProjectsSheet
        open={openSheet === "projects"}
        onOpenChange={(o) => setOpenSheet(o ? "projects" : null)}
      />
      <MobileTaskSearchSheet
        open={openSheet === "search"}
        onOpenChange={(o) => setOpenSheet(o ? "search" : null)}
      />
      <MobileAccountSheet
        open={openSheet === "you"}
        onOpenChange={(o) => setOpenSheet(o ? "you" : null)}
      />
    </>
  );
}

function NavTab({
  to,
  onClick,
  children,
}: {
  to: string;
  onClick?: () => void;
  children: (state: { isActive: boolean }) => ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors",
          isActive ? "text-foreground" : "text-[#708597]"
        )
      }
    >
      {children}
    </NavLink>
  );
}

function SheetTabButton({
  active,
  className,
  children,
  ...rest
}: { active: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors",
        active ? "text-foreground" : "text-[#708597]",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

function NavLabel({ children }: { children: ReactNode }) {
  // whitespace-nowrap keeps "My Tasks" on one line when the tab bar
  // packs 5 columns at iPhone SE widths.
  return <span className="whitespace-nowrap leading-none">{children}</span>;
}

function InboxTabIcon({ active }: { active: boolean }) {
  const { data: notifications } = useNotifications();
  const unread = (notifications ?? []).filter((n) => !n.read_at).length;
  return (
    <div className="relative">
      <IconBell className="h-6 w-6" strokeWidth={active ? 2.5 : 2} />
      {unread > 0 && (
        <span
          className="absolute -top-1 -right-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-bold text-background"
          aria-hidden
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </div>
  );
}

function TasksTabIcon({ active }: { active: boolean }) {
  const { data: tasks } = useMyTasks();
  const activeCount = (tasks ?? []).filter((t) => t.status !== "done").length;
  return (
    <div className="relative">
      <IconCircleCheck className="h-6 w-6" strokeWidth={active ? 2.5 : 2} />
      {activeCount > 0 && (
        <span
          className="absolute -top-1 -right-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full border border-[#DEDFE0] bg-white px-1 text-[9px] font-bold text-[#708597]"
          aria-hidden
        >
          {activeCount > 9 ? "9+" : activeCount}
        </span>
      )}
    </div>
  );
}

// A full-screen sheet that stops above the bottom nav so the nav stays
// visible (and its active tab keeps signalling which sheet is open).
// The nav is h-14 (3.5rem) plus the bottom safe-area inset, so the sheet
// is pinned that far up from the viewport bottom and spans the rest of
// the screen.
const NAV_OFFSET = "calc(3.5rem + env(safe-area-inset-bottom))";
// `[&>button]:hidden` suppresses the Sheet's built-in absolute close X
// (Radix renders it as the content's last child <button>) — these
// full-screen sheets carry their own header and are dismissed by tapping
// another bottom-nav tab, matching the Figma which shows no X. Scoped to
// this className only, so the shared Sheet primitive and desktop are
// untouched.
const sheetShellClass =
  "top-0 left-0 right-0 h-auto w-full max-w-none gap-0 rounded-none !border-0 bg-white p-0 shadow-none flex flex-col [&>button]:hidden";

function MobileProjectsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: workspace } = useWorkspace();
  const { data: projects } = useProjects(workspace?.id);
  const unseen = useUnseenProjects();
  const navigate = useNavigate();
  const [newOpen, setNewOpen] = useState(false);

  return (
    <>
      {/* modal={false} keeps the bottom nav interactive while the sheet is
          open so tapping another tab switches/closes it (Radix's default
          modal mode blocks pointer events on everything outside the
          portal). */}
      <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
        <SheetContent
          side="full"
          style={{ bottom: NAV_OFFSET }}
          className={sheetShellClass}
        >
          <SheetTitle className="sr-only">Projects</SheetTitle>

          <header className="shrink-0 px-4 pt-4 pb-2">
            <div className="flex h-[41px] items-center gap-2 min-w-0">
              <Folder className="h-6 w-6 shrink-0 text-foreground" strokeWidth={1.75} />
              <h2 className="flex-1 text-lg font-semibold leading-tight truncate text-foreground">
                Projects
              </h2>
              <button
                type="button"
                onClick={() => setNewOpen(true)}
                disabled={!workspace?.id}
                aria-label="New project"
                className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-[#EDF2F4] disabled:opacity-40"
              >
                <Plus className="h-6 w-6" strokeWidth={1.75} />
              </button>
            </div>
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 pt-2">
            <ul className="flex flex-col gap-2">
              {(projects ?? []).map((project) => (
                <MobileProjectCard
                  key={project.id}
                  project={project}
                  hasUnseen={unseen.has(project.id)}
                  onOpen={() => navigate(`/projects/${project.id}`)}
                />
              ))}
              {projects && projects.length === 0 && (
                <li>
                  <button
                    type="button"
                    onClick={() => setNewOpen(true)}
                    className="w-full rounded-xl border border-dashed border-[#DEDFE0] p-4 text-center text-sm text-[#708597] transition-colors hover:text-foreground"
                  >
                    No projects yet. Create one
                  </button>
                </li>
              )}
            </ul>
          </div>
        </SheetContent>
      </Sheet>

      <NewProjectDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        workspaceId={workspace?.id}
      />
    </>
  );
}

function MobileProjectCard({
  project,
  hasUnseen = false,
  onOpen,
}: {
  project: Project;
  hasUnseen?: boolean;
  onOpen: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <li>
      <div className="flex items-center gap-2 rounded-xl border border-[#DEDFE0] bg-white p-3 shadow-[0px_2px_2px_rgba(0,0,0,0.08)]">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ProjectLetterPill color={project.color} name={project.name} />
          <span className="min-w-0 truncate text-sm font-medium text-black">
            {project.name}
          </span>
          {hasUnseen && (
            <>
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              />
              <span className="sr-only">— has new tasks</span>
            </>
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Actions for ${project.name}`}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#708597] transition-colors hover:bg-[#EDF2F4]"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setDeleteOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <EditProjectDialog
        project={project}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <MobileDeleteProjectDialog
        project={project}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </li>
  );
}

function MobileDeleteProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const isCurrent = location.pathname === `/projects/${project.id}`;
  const deleteProject = useDeleteProject(project.workspace_id);

  const onConfirm = async () => {
    try {
      await deleteProject.mutateAsync(project.id);
      onOpenChange(false);
      if (isCurrent) {
        navigate("/", { replace: true });
      }
    } catch {
      // Toast already fired.
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{project.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This will also delete every task in this project. This action can't
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function MobileAccountSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, signOut } = useAuth();
  const { data: workspace } = useWorkspace();
  const { data: workspaces } = useWorkspaces();
  const { currentWorkspaceId, setCurrentWorkspaceId } = useCurrentWorkspaceId();
  const effectiveCurrentId = currentWorkspaceId ?? workspaces?.[0]?.id ?? null;
  const [membersOpen, setMembersOpen] = useState(false);
  // No global theme provider exists in this app, so the toggle holds
  // local state only — matching the Figma without re-theming surfaces
  // that rely on hardcoded hex tokens.
  const [darkMode, setDarkMode] = useState(false);
  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email ??
    "User";
  const initials = userInitials(user);
  const currentWorkspaceName = workspace?.name ?? "Workspace";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
        <SheetContent
          side="full"
          style={{ bottom: NAV_OFFSET }}
          className={sheetShellClass}
        >
          <SheetTitle className="sr-only">Profile</SheetTitle>

          <header className="shrink-0 px-4 pt-4 pb-2">
            <div className="flex h-[41px] items-center gap-2 min-w-0">
              <UserCircle2 className="h-6 w-6 shrink-0 text-foreground" strokeWidth={1.75} />
              <h2 className="text-lg font-semibold leading-tight text-foreground">
                Profile
              </h2>
            </div>
          </header>

          {/* Top-aligned, scrollable. Children flow from the top — identity
              then the two grouped sections — so nothing is pushed to the
              bottom. pt-10 gives the comfortable gap above the avatar the
              Figma shows. */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6">
            {/* Identity block */}
            <div className="flex flex-col items-center gap-3 pt-10 pb-8">
              <Avatar className="h-24 w-24">
                <AvatarFallback
                  className={cn("text-3xl font-bold", avatarColor(user?.id))}
                >
                  {initials || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-center gap-1 text-center">
                <p className="text-[22px] font-semibold leading-tight text-black">
                  {fullName}
                </p>
                <p className="text-sm text-[#708597]">{user?.email}</p>
              </div>
            </div>

            <hr className="h-px border-0 bg-[#DEDFE0]" />

            {/* Group 1: workspace switcher + members */}
            <div className="flex flex-col py-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-3 text-left transition-colors hover:bg-[#EDF2F4]"
                    aria-label="Switch workspace"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-black">
                      {currentWorkspaceName}
                    </span>
                    <ChevronDown className="h-[18px] w-[18px] shrink-0 text-black" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {workspaces?.map((w) => (
                    <DropdownMenuItem
                      key={w.id}
                      onSelect={() => setCurrentWorkspaceId(w.id)}
                      className="gap-2"
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full bg-foreground",
                          w.id === effectiveCurrentId
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                        aria-hidden
                      />
                      <span className="truncate">{w.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                type="button"
                onClick={() => setMembersOpen(true)}
                className="flex items-center gap-2 rounded-lg px-2 py-3 text-left transition-colors hover:bg-[#EDF2F4]"
              >
                <Users className="h-6 w-6 shrink-0 text-black" strokeWidth={1.75} />
                <span className="text-sm font-medium text-black">
                  Workspace members
                </span>
              </button>
            </div>

            <hr className="h-px border-0 bg-[#DEDFE0]" />

            {/* Group 2: dark mode, email notifications, sign out */}
            <div className="flex flex-col py-2">
              <button
                type="button"
                onClick={() => setDarkMode((v) => !v)}
                aria-pressed={darkMode}
                className="flex items-center gap-2 rounded-lg px-2 py-3 text-left transition-colors hover:bg-[#EDF2F4]"
              >
                <Moon className="h-6 w-6 shrink-0 text-black" strokeWidth={1.75} />
                <span className="flex-1 text-sm font-medium text-black">
                  Dark mode
                </span>
                <span
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                    darkMode ? "bg-foreground" : "bg-[#DEDFE0]"
                  )}
                  aria-hidden
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                      darkMode ? "translate-x-4" : "translate-x-0.5"
                    )}
                  />
                </span>
              </button>

              <Link
                to="/settings/email"
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-2 rounded-lg px-2 py-3 transition-colors hover:bg-[#EDF2F4]"
              >
                <Mail className="h-6 w-6 shrink-0 text-black" strokeWidth={1.75} />
                <span className="text-sm font-medium text-black">
                  E-mail notifications
                </span>
              </Link>

              <button
                type="button"
                onClick={() => void signOut()}
                className="flex items-center gap-2 rounded-lg px-2 py-3 text-left text-[#EF4444] transition-colors hover:bg-[#EDF2F4]"
              >
                <LogOut className="h-6 w-6 shrink-0" strokeWidth={1.75} />
                <span className="text-sm font-medium">Sign out</span>
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <MembersDialog
        workspace={workspace ?? null}
        open={membersOpen}
        onOpenChange={setMembersOpen}
      />
    </>
  );
}

function userInitials(user: ReturnType<typeof useAuth>["user"]) {
  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";
  return fullName
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

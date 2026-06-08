import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { FolderKanban, LogOut, Mail, Users } from "lucide-react";

import { IconBell, IconCircleCheck, IconSearch } from "@/components/icons/figma";
import { ProjectsSection } from "@/components/Sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/features/auth/AuthProvider";
import { useNotifications } from "@/features/notifications/useNotifications";
import { useMyTasks } from "@/features/tasks/useMyTasks";
import { MobileTaskSearchSheet } from "@/features/tasks/MobileTaskSearchSheet";
import { useCurrentWorkspaceId } from "@/features/workspaces/CurrentWorkspaceProvider";
import { MembersDialog } from "@/features/workspaces/MembersDialog";
import { useWorkspace, useWorkspaces } from "@/features/workspaces/useWorkspace";
import { avatarColor } from "@/lib/avatarColor";
import { cn } from "@/lib/utils";

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
        className="shrink-0 z-10 bg-white border-t border-[#DEDFE0] pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        <div className="flex h-14">
          <NavTab to="/inbox" onClick={closeSheet}>
            <InboxTabIcon />
            <NavLabel>Inbox</NavLabel>
          </NavTab>
          <NavTab to="/my-tasks" onClick={closeSheet}>
            <TasksTabIcon />
            <NavLabel>My Tasks</NavLabel>
          </NavTab>
          <SheetTabButton
            active={openSheet === "projects"}
            onClick={() => setOpenSheet("projects")}
            aria-label="Projects"
          >
            <FolderKanban className="h-6 w-6" strokeWidth={1.75} />
            <NavLabel>Projects</NavLabel>
          </SheetTabButton>
          <SheetTabButton
            active={openSheet === "search"}
            onClick={() => setOpenSheet("search")}
            aria-label="Search"
          >
            <IconSearch className="h-6 w-6" />
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
  children: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
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
        "flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
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

function InboxTabIcon() {
  const { data: notifications } = useNotifications();
  const unread = (notifications ?? []).filter((n) => !n.read_at).length;
  return (
    <div className="relative">
      <IconBell className="h-6 w-6" />
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

function TasksTabIcon() {
  const { data: tasks } = useMyTasks();
  const activeCount = (tasks ?? []).filter((t) => t.status !== "done").length;
  return (
    <div className="relative">
      <IconCircleCheck className="h-6 w-6" />
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

function MobileProjectsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: workspace } = useWorkspace();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[80vh] gap-0 rounded-t-2xl p-0 flex flex-col"
      >
        <SheetTitle className="sr-only">Projects</SheetTitle>
        {/* pt-12 reserves space for the sheet's built-in close X
            (positioned absolutely at top-4 right-4). */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-12 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <ProjectsSection workspaceId={workspace?.id} />
        </div>
      </SheetContent>
    </Sheet>
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
  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "User";
  const initials = userInitials(user);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-auto max-h-[80vh] gap-0 rounded-t-2xl p-0 flex flex-col"
        >
          <SheetTitle className="sr-only">Account</SheetTitle>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-12 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="flex flex-col gap-6">
              <section className="flex flex-col gap-1">
                <h3 className="px-2 py-2 text-xs font-semibold text-foreground">
                  WORKSPACES
                </h3>
                <ul className="flex flex-col">
                  {workspaces?.map((w) => (
                    <li key={w.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentWorkspaceId(w.id);
                          onOpenChange(false);
                        }}
                        className="w-full flex items-center gap-2 rounded-lg p-2 text-left text-sm font-medium transition-colors hover:bg-[#EDF2F4]"
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full bg-foreground",
                            w.id === effectiveCurrentId ? "opacity-100" : "opacity-0"
                          )}
                          aria-hidden
                        />
                        <span className="truncate">{w.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setMembersOpen(true)}
                  className="flex items-center gap-2 rounded-lg p-2 text-sm font-medium transition-colors hover:bg-[#EDF2F4]"
                >
                  <Users className="h-4 w-4" />
                  <span>Workspace members</span>
                </button>
              </section>

              <hr className="h-px border-0 bg-[#DEDFE0]" />

              <section className="flex flex-col gap-2">
                <div className="flex items-center gap-3 px-2">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback
                      className={cn("text-sm font-bold", avatarColor(user?.id))}
                    >
                      {initials || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{fullName}</p>
                    <p className="truncate text-xs text-[#708597]">{user?.email}</p>
                  </div>
                </div>
                <Link
                  to="/settings/email"
                  onClick={() => onOpenChange(false)}
                  className="flex items-center gap-2 rounded-lg p-2 text-sm font-medium transition-colors hover:bg-[#EDF2F4]"
                >
                  <Mail className="h-4 w-4" />
                  <span>Email notifications</span>
                </Link>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="flex items-center gap-2 rounded-lg p-2 text-sm font-medium transition-colors hover:bg-[#EDF2F4]"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </button>
              </section>
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

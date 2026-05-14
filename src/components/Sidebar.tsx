import { useState } from "react";
import { Check, ChevronDown, LogOut, Plus, Users } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarColor } from "@/lib/avatarColor";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/AuthProvider";
import { InboxLink } from "@/features/notifications/InboxLink";
import { NewProjectDialog } from "@/features/projects/NewProjectDialog";
import { ProjectRow } from "@/features/projects/ProjectRow";
import { useProjects } from "@/features/projects/useProjects";
import { MyTasksLink } from "@/features/tasks/MyTasksLink";
import { useCurrentWorkspaceId } from "@/features/workspaces/CurrentWorkspaceProvider";
import { MembersDialog } from "@/features/workspaces/MembersDialog";
import { useWorkspace, useWorkspaces } from "@/features/workspaces/useWorkspace";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { data: workspace, isLoading: workspaceLoading } = useWorkspace();
  const [membersOpen, setMembersOpen] = useState(false);

  return (
    <aside className="w-64 shrink-0 border-r bg-[#F5F7FA] flex flex-col">
      <div className="px-2 h-14 border-b flex items-center">
        {workspaceLoading ? (
          <Skeleton className="h-4 w-32 mx-2 flex-1" />
        ) : (
          <WorkspaceSwitcher
            currentName={workspace?.name ?? "Workspace"}
            onOpenMembers={() => setMembersOpen(true)}
          />
        )}
      </div>

      {/* Top-level nav rows between the workspace header and the projects
          list: Inbox and My tasks. Unread/assigned counts render as badges. */}
      <div className="px-2 py-[13.5px] border-b space-y-0.5">
        <InboxLink />
        <MyTasksLink />
      </div>

      <ProjectsSection workspaceId={workspace?.id} />

      <div className="p-2 border-t">
        <UserMenu />
      </div>

      <MembersDialog
        workspace={workspace ?? null}
        open={membersOpen}
        onOpenChange={setMembersOpen}
      />
    </aside>
  );
}

function WorkspaceSwitcher({
  currentName,
  onOpenMembers,
}: {
  currentName: string;
  onOpenMembers: () => void;
}) {
  const { data: workspaces } = useWorkspaces();
  const { currentWorkspaceId, setCurrentWorkspaceId } = useCurrentWorkspaceId();
  // Fall back to the first workspace's id when nothing's saved yet, so the
  // checkmark renders correctly on first load.
  const effectiveCurrentId = currentWorkspaceId ?? workspaces?.[0]?.id ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="w-full flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-accent text-left"
          aria-label="Switch workspace"
        >
          <span className="text-sm font-semibold truncate flex-1" title={currentName}>
            {currentName}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Workspaces
        </DropdownMenuLabel>
        {workspaces?.map((w) => (
          <DropdownMenuItem
            key={w.id}
            onSelect={() => setCurrentWorkspaceId(w.id)}
            className="gap-2"
          >
            <Check
              className={cn(
                "h-3.5 w-3.5",
                w.id === effectiveCurrentId ? "opacity-100" : "opacity-0"
              )}
            />
            <span className="truncate">{w.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onOpenMembers}>
          <Users className="mr-2 h-3.5 w-3.5" />
          Workspace members
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProjectsSection({ workspaceId }: { workspaceId: string | undefined }) {
  const { data: projects, isLoading } = useProjects(workspaceId);
  const [newOpen, setNewOpen] = useState(false);

  return (
    <div className="flex-1 overflow-y-auto p-2">
      <div className="flex items-center justify-between px-2 mb-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Projects
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          aria-label="New project"
          onClick={() => setNewOpen(true)}
          disabled={!workspaceId}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-1 px-2 py-1">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-4/5" />
          <Skeleton className="h-6 w-3/5" />
        </div>
      ) : projects && projects.length > 0 ? (
        <div className="space-y-0.5">
          {projects.map((project) => (
            <ProjectRow key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          No projects yet. Create one →
        </button>
      )}

      <NewProjectDialog open={newOpen} onOpenChange={setNewOpen} workspaceId={workspaceId} />
    </div>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "User";
  const initials = fullName
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="w-full flex items-center gap-2 rounded-md p-2 hover:bg-accent text-left transition-colors"
          aria-label="Account menu"
        >
          <Avatar className="h-7 w-7">
            <AvatarFallback className={cn("text-xs", avatarColor(user?.id))}>
              {initials || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{fullName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

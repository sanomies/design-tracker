import { useState } from "react";
import { LogOut, Mail, Users } from "lucide-react";
import { Link } from "react-router-dom";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { IconChevronDown, IconPlus } from "@/components/icons/figma";
import osanoLogo from "@/assets/brand/osano-logo.svg";
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
import { useProjects, useReorderProject } from "@/features/projects/useProjects";
import { MyTasksLink } from "@/features/tasks/MyTasksLink";
import { useCurrentWorkspaceId } from "@/features/workspaces/CurrentWorkspaceProvider";
import { MembersDialog } from "@/features/workspaces/MembersDialog";
import { useWorkspace, useWorkspaces } from "@/features/workspaces/useWorkspace";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { data: workspace, isLoading: workspaceLoading } = useWorkspace();
  const [membersOpen, setMembersOpen] = useState(false);

  return (
    <aside className="relative z-10 w-[250px] shrink-0 border-r border-[#DEDFE0] bg-white flex flex-col py-6 px-4">
      {/* Top column: nav rows + projects. Scrolls when the projects list
          grows past the available height. */}
      <div className="flex-1 min-h-0 flex flex-col gap-6 overflow-y-auto">
        {/* Brand mark + primary nav. The Figma groups them in one
            `gap-[16px] items-center` block — the oSano logo centred,
            the Inbox / My tasks rows beneath it stretched full-width
            and flush against each other (each row's own p-2 spaces them). */}
        <div className="flex flex-col gap-4 items-center">
          <img
            src={osanoLogo}
            alt="oSano"
            className="h-[22px] w-auto shrink-0"
          />
          <div className="w-full">
            <InboxLink />
            <MyTasksLink />
          </div>
        </div>

        <hr className="border-0 h-px bg-[#DEDFE0]" />

        <ProjectsSection workspaceId={workspace?.id} />
      </div>

      {/* Bottom dock: workspace switcher, divider, user card. */}
      <div className="shrink-0 flex flex-col gap-4">
        {workspaceLoading ? (
          <Skeleton className="h-5 w-40" />
        ) : (
          <WorkspaceSwitcher
            currentName={workspace?.name ?? "Workspace"}
            onOpenMembers={() => setMembersOpen(true)}
          />
        )}

        <hr className="border-0 h-px bg-[#DEDFE0]" />

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
          className="w-full flex items-center gap-2 rounded-lg p-2 hover:bg-[#EDF2F4] text-left transition-colors"
          aria-label="Switch workspace"
        >
          <span className="text-sm font-medium truncate flex-1" title={currentName}>
            {currentName}
          </span>
          <IconChevronDown className="h-6 w-6 text-foreground/80" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-xs text-[#708597]">
          Workspaces
        </DropdownMenuLabel>
        {workspaces?.map((w) => (
          <DropdownMenuItem
            key={w.id}
            onSelect={() => setCurrentWorkspaceId(w.id)}
            className="gap-2"
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full bg-foreground",
                w.id === effectiveCurrentId ? "opacity-100" : "opacity-0"
              )}
              aria-hidden
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
  const reorderProject = useReorderProject(workspaceId);
  const [newOpen, setNewOpen] = useState(false);

  // 8px activation distance so a click on a project row navigates as
  // usual — only a deliberate vertical drag starts a reorder.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id || !projects) return;

    const oldIdx = projects.findIndex((p) => p.id === active.id);
    const newIdxAmongAll = projects.findIndex((p) => p.id === over.id);
    if (oldIdx === -1 || newIdxAmongAll === -1) return;

    // Compute the dropped row's new position as the midpoint between
    // the neighbours of its new slot — same pattern sections use. Drop
    // direction (above vs below the target) decides which two
    // neighbours we interpolate between.
    const filtered = projects.filter((p) => p.id !== active.id);
    const overIdx = filtered.findIndex((p) => p.id === over.id);
    if (overIdx === -1) return;

    const placeAfter = newIdxAmongAll > oldIdx;
    const here = filtered[overIdx]!;
    let newPosition: number;
    if (placeAfter) {
      const next = filtered[overIdx + 1];
      newPosition = next
        ? (here.position + next.position) / 2
        : here.position + 1024;
    } else {
      const prev = filtered[overIdx - 1];
      newPosition = prev
        ? (prev.position + here.position) / 2
        : here.position - 1024;
    }

    const moved = projects[oldIdx]!;
    if (moved.position !== newPosition) {
      reorderProject.mutate({ id: active.id as string, position: newPosition });
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-2 py-2">
        <span className="text-xs font-semibold text-foreground">
          PROJECTS
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 -mr-1"
          aria-label="New project"
          onClick={() => setNewOpen(true)}
          disabled={!workspaceId}
        >
          <IconPlus className="h-6 w-6" />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-1 px-1">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-4/5" />
          <Skeleton className="h-8 w-3/5" />
        </div>
      ) : projects && projects.length > 0 ? (
        // Project rows are flush per Figma — no inter-row gap.
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={projects.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div>
              {projects.map((project) => (
                <ProjectRow key={project.id} project={project} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="w-full text-left px-2 py-1.5 text-xs text-[#708597] hover:text-foreground transition-colors"
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
          className="w-full flex items-center gap-2 rounded-lg p-2 hover:bg-[#EDF2F4] text-left transition-colors"
          aria-label="Account menu"
        >
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className={cn("text-xs font-bold", avatarColor(user?.id))}>
              {initials || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{fullName}</p>
            <p className="text-xs text-[#708597] truncate">{user?.email}</p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings/email">
            <Mail className="mr-2 h-4 w-4" />
            Email notifications
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { useState } from "react";
import { LogOut, Plus } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { NewProjectDialog } from "@/features/projects/NewProjectDialog";
import { ProjectRow } from "@/features/projects/ProjectRow";
import { useProjects } from "@/features/projects/useProjects";
import { useWorkspace } from "@/features/workspaces/useWorkspace";

export function Sidebar() {
  const { data: workspace, isLoading: workspaceLoading } = useWorkspace();

  return (
    <aside className="w-64 shrink-0 border-r bg-muted/30 flex flex-col">
      <div className="px-4 h-14 border-b flex items-center">
        {workspaceLoading ? (
          <Skeleton className="h-4 w-32" />
        ) : (
          <h2 className="text-sm font-semibold truncate" title={workspace?.name}>
            {workspace?.name ?? "Workspace"}
          </h2>
        )}
      </div>

      <ProjectsSection workspaceId={workspace?.id} />

      <div className="p-2 border-t">
        <UserMenu />
      </div>
    </aside>
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
            <AvatarFallback className="text-xs">{initials || "?"}</AvatarFallback>
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

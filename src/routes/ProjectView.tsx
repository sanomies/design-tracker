import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { Skeleton } from "@/components/ui/skeleton";
import { projectColorClass } from "@/features/projects/colors";
import { useProjects } from "@/features/projects/useProjects";
import { TaskDetailPanel } from "@/features/tasks/TaskDetailPanel";
import { TaskList } from "@/features/tasks/TaskList";
import { useTasks } from "@/features/tasks/useTasks";
import { useWorkspace } from "@/features/workspaces/useWorkspace";
import { useResizablePanel } from "@/hooks/useResizablePanel";
import { cn } from "@/lib/utils";

export default function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: workspace } = useWorkspace();
  const { data: projects, isLoading: projectsLoading } = useProjects(workspace?.id);
  const project = projects?.find((p) => p.id === projectId);

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTaskId = searchParams.get("task");

  const { data: tasks } = useTasks(projectId);
  const selectedTask = tasks?.find((t) => t.id === selectedTaskId) ?? null;
  const panelOpen = selectedTask !== null;

  const { width: panelWidth, isResizing, onPointerDown } = useResizablePanel({
    defaultWidth: 600,
    min: 360,
    max: 1000,
  });

  const closePanel = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("task");
    setSearchParams(next, { replace: true });
  };

  // Esc closes the panel — but only if there's no open dialog/menu first,
  // so it doesn't fight with form dialogs (delete confirm, link form, etc.).
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const blocking =
        document.querySelector('[role="dialog"][data-state="open"]') ||
        document.querySelector('[role="menu"][data-state="open"]') ||
        document.querySelector('[role="listbox"][data-state="open"]');
      if (blocking) return;
      closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen, searchParams]);

  if (!projectId) return null;

  return (
    <div className="h-full flex">
      <section className="flex-1 min-w-0 flex flex-col">
        <header className="border-b px-6 h-14 flex items-center gap-3 shrink-0">
          {projectsLoading ? (
            <Skeleton className="h-5 w-48" />
          ) : project ? (
            <>
              <span
                className={cn("h-3 w-3 rounded-full", projectColorClass(project.color))}
                aria-hidden
              />
              <h1 className="text-base font-semibold">{project.name}</h1>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Project not found</p>
          )}
        </header>

        <div className="flex-1 overflow-y-auto">
          <TaskList projectId={projectId} workspaceId={workspace?.id} />
        </div>
      </section>

      <aside
        aria-hidden={!panelOpen}
        style={{ width: panelOpen ? panelWidth : 0 }}
        className={cn(
          "relative shrink-0 overflow-hidden border-l bg-background",
          // Transition open/close only — never during a drag.
          !isResizing && "transition-[width] duration-200 ease-out",
          panelOpen && "shadow-[-12px_0_28px_-16px_rgba(0,0,0,0.18)]"
        )}
      >
        {panelOpen && (
          <button
            type="button"
            aria-label="Resize panel"
            onPointerDown={onPointerDown}
            className="group absolute inset-y-0 left-0 z-10 w-2 cursor-col-resize focus:outline-none"
          >
            <span
              className={cn(
                "block h-full w-px mx-auto transition-colors",
                isResizing ? "bg-primary/60" : "bg-transparent group-hover:bg-primary/40"
              )}
            />
          </button>
        )}

        {/* Inner is locked to the chosen width so content doesn't reflow
            during the open/close transition. */}
        <div style={{ width: panelWidth }} className="h-full">
          {selectedTask && (
            <TaskDetailPanel
              key={selectedTask.id}
              task={selectedTask}
              workspaceId={workspace?.id}
              onClose={closePanel}
            />
          )}
        </div>
      </aside>
    </div>
  );
}

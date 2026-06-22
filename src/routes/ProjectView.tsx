import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { Skeleton } from "@/components/ui/skeleton";
import { ProjectLetterPill } from "@/features/projects/ProjectRow";
import { useProjects } from "@/features/projects/useProjects";
import { useMarkProjectSeen } from "@/features/projects/useUnseenProjects";
import { MobileTaskList } from "@/features/tasks/MobileTaskList";
import { TaskDetailPanel } from "@/features/tasks/TaskDetailPanel";
import { MobileTaskOverlay } from "@/features/tasks/MobileTaskOverlay";
import { TaskList } from "@/features/tasks/TaskList";
import { TaskSearchCombobox } from "@/features/tasks/TaskSearchCombobox";
import { recordTaskOpened } from "@/features/tasks/useRecentTasks";
import { useTasks } from "@/features/tasks/useTasks";
import { useWorkspace } from "@/features/workspaces/useWorkspace";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useResizablePanel } from "@/hooks/useResizablePanel";
import { cn } from "@/lib/utils";

export const LAST_PROJECT_STORAGE_PREFIX = "design-tracker:last-project:";

export default function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: workspace } = useWorkspace();
  const { data: projects, isLoading: projectsLoading } = useProjects(workspace?.id);
  const project = projects?.find((p) => p.id === projectId);

  // Remember the most recently viewed project per workspace, keyed by
  // workspace id so switching workspaces doesn't cross-contaminate. The
  // home route reads this on mount to auto-redirect.
  useEffect(() => {
    if (!projectId || !project) return;
    try {
      localStorage.setItem(
        `${LAST_PROJECT_STORAGE_PREFIX}${project.workspace_id}`,
        projectId
      );
    } catch {
      // private mode / quota — ignore
    }
  }, [projectId, project]);

  // Opening a project marks it seen, clearing its "unseen tasks" dot in the
  // sidebar. Fire on projectId change (not project load) so it still clears
  // when navigating between projects.
  const markProjectSeen = useMarkProjectSeen();
  useEffect(() => {
    if (projectId) markProjectSeen.mutate(projectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTaskId = searchParams.get("task");

  // Push the currently-open task id onto the recents stack so the global
  // search combobox can show it next time the user opens search.
  useEffect(() => {
    if (selectedTaskId) recordTaskOpened(selectedTaskId);
  }, [selectedTaskId]);

  const { data: tasks } = useTasks(projectId);
  const selectedTask = tasks?.find((t) => t.id === selectedTaskId) ?? null;
  const panelOpen = selectedTask !== null;
  const isMobile = useIsMobile();

  const { width: panelWidth, isResizing, onPointerDown } = useResizablePanel({
    defaultWidth: 600,
    min: 360,
    max: 1000,
  });

  // Fullscreen mode for the detail panel — toggled from the panel's
  // header. Reset whenever the panel closes so reopening starts in the
  // default sidebar layout. On mobile the side panel layout never
  // applies — the panel is always rendered as a full-screen overlay.
  const [panelFullscreen, setPanelFullscreen] = useState(false);
  useEffect(() => {
    if (!panelOpen) setPanelFullscreen(false);
  }, [panelOpen]);
  const showAsFullscreen = panelFullscreen || isMobile;

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
    <div className="relative h-full flex">
      <section className="flex-1 min-w-0 flex flex-col">
        {/* Header + action row are visually one block in the Figma —
            16px outer padding with an 8px gap between the rows. The
            action row (rendered inside TaskList) owns the 8px via its
            own `pt-2`; the header here keeps `pb-0`. On mobile the header
            (project chip + title) is rendered INSIDE MobileTaskList so the
            whole board scrolls as one column and the chip aligns with the
            board's own padding — so this desktop header is hidden there. */}
        {!isMobile && (
          <header className="px-4 pt-4 pb-0 flex items-center gap-3 shrink-0">
            {projectsLoading ? (
              <Skeleton className="h-7 w-48" />
            ) : project ? (
              <div className="flex items-center gap-2 py-2">
                <ProjectLetterPill color={project.color} name={project.name} />
                <h1 className="text-lg font-semibold leading-tight">{project.name}</h1>
              </div>
            ) : (
              <p className="text-sm text-[#708597]">Project not found</p>
            )}
            {/* flex-1 + justify-end lets the search grow into all
                remaining header width; the combobox itself caps at
                400px and stays right-aligned within. */}
            <div className="ml-auto flex-1 flex justify-end">
              <TaskSearchCombobox workspaceId={workspace?.id} />
            </div>
          </header>
        )}

        {/* TaskList owns its own scrolling so the Done section can stay
            docked at the bottom. Outer wrapper just needs to be a flex
            child with min-h-0 so its children can shrink. Mobile uses a
            separate component (pinned Name + horizontal-scroll metadata)
            — switching at this level so the breakpoint flip mounts/
            unmounts entirely separate trees instead of changing the
            shared TaskList's hook count mid-render. */}
        <div className="flex-1 min-h-0">
          {isMobile ? (
            // Clip + slide the board in from the right on each project open
            // (keyed by projectId so switching projects re-animates). The
            // board scrolls internally, so overflow-hidden here is safe.
            <div className="h-full overflow-hidden">
              <div
                key={projectId}
                className="h-full animate-in slide-in-from-right duration-300 ease-out"
              >
                <MobileTaskList
                  projectId={projectId}
                  workspaceId={workspace?.id}
                  projectName={project?.name ?? ""}
                  projectColor={project?.color}
                />
              </div>
            </div>
          ) : (
            <TaskList projectId={projectId} workspaceId={workspace?.id} />
          )}
        </div>
      </section>

      {/* Sidebar rendering — only used when NOT in fullscreen mode.
          Width animates between 0 (closed) and `panelWidth` (open).
          On mobile the side layout never applies — the panel always
          renders as a fullscreen overlay below. */}
      <aside
        aria-hidden={!panelOpen || showAsFullscreen}
        style={{ width: panelOpen && !showAsFullscreen ? panelWidth : 0 }}
        className={cn(
          // z-30 puts the panel + its left-edge shadow above the
          // TaskList's sticky column header (z-20), so the shadow
          // visually wraps over the header row's right edge instead
          // of being capped at it.
          "relative z-30 shrink-0 overflow-hidden border-l bg-background",
          // Transition open/close only — never during a drag.
          !isResizing && "transition-[width] duration-200 ease-out",
          panelOpen && !showAsFullscreen && "shadow-[-12px_0_28px_-16px_rgba(0,0,0,0.18)]"
        )}
      >
        {/* Inner is locked to the chosen width so content doesn't reflow
            during the open/close transition. */}
        <div style={{ width: panelWidth }} className="h-full">
          {selectedTask && !showAsFullscreen && (
            <TaskDetailPanel
              key={selectedTask.id}
              task={selectedTask}
              workspaceId={workspace?.id}
              onClose={closePanel}
              isFullscreen={false}
              onToggleFullscreen={() => setPanelFullscreen(true)}
            />
          )}
        </div>
      </aside>

      {/* Resize handle lives OUTSIDE the aside so it can straddle the
          panel's outer-left edge without being clipped by the aside's
          overflow-hidden. The 8px hit target centers on the edge; the 1px
          visible indicator sits exactly on it. Hidden while fullscreen. */}
      {panelOpen && !showAsFullscreen && (
        <button
          type="button"
          aria-label="Resize panel"
          onPointerDown={onPointerDown}
          style={{ right: panelWidth - 4 }}
          className={cn(
            "group absolute top-0 bottom-0 z-20 w-2 cursor-col-resize focus:outline-none",
            !isResizing && "transition-[right] duration-200 ease-out"
          )}
        >
          <span
            className={cn(
              "block h-full w-px mx-auto transition-colors",
              isResizing ? "bg-primary/60" : "bg-transparent group-hover:bg-primary/40"
            )}
          />
        </button>
      )}

      {/* Fullscreen overlay — rendered on top of everything (above the
          sidebar's z-10) so the task panel covers the entire viewport.
          On mobile this is the ONLY way the panel ever renders, so the
          toggle-fullscreen control is omitted (only close is offered).
          The mobile overlay stops just above the 56px bottom tab bar
          (+ safe area) so the nav stays visible and the user can switch
          to Inbox / My Tasks / Search without first closing the task. */}
      {/* Mobile: slides in from the right on open, back out on close. */}
      {isMobile && (
        <MobileTaskOverlay
          task={selectedTask}
          workspaceId={workspace?.id}
          onClose={closePanel}
        />
      )}

      {/* Desktop fullscreen (the expand toggle) — instant, with the
          minimize control. */}
      {!isMobile && selectedTask && showAsFullscreen && (
        <div className="fixed inset-x-0 top-0 bottom-0 z-50 bg-background">
          <TaskDetailPanel
            key={`${selectedTask.id}-fs`}
            task={selectedTask}
            workspaceId={workspace?.id}
            onClose={closePanel}
            isFullscreen
            onToggleFullscreen={() => setPanelFullscreen(false)}
          />
        </div>
      )}
    </div>
  );
}

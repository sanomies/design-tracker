import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  Check,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AddSectionDialog,
  DeleteSectionDialog,
  RenameSectionDialog,
} from "@/features/sections/SectionDialogs";
import { SectionBlock } from "@/features/sections/SectionBlock";
import { SortableSection, sectionRowId } from "@/features/sections/SortableSection";
import { SortableTaskRow } from "@/features/tasks/SortableTaskRow";
import { TaskDetailPanel } from "@/features/tasks/TaskDetailPanel";
import { TaskRow } from "@/features/tasks/TaskRow";
import {
  useCreateMySection,
  useDeleteMySection,
  useRenameMySection,
  useReorderMySection,
  useMySections,
} from "@/features/tasks/useMySections";
import { useMyTasks, useUpdateMyTask, type MyTaskRow } from "@/features/tasks/useMyTasks";
import { useResizableHeight } from "@/hooks/useResizableHeight";
import { useResizablePanel } from "@/hooks/useResizablePanel";
import { cn } from "@/lib/utils";
import type { MyTaskSection, Section, Task } from "@/types/database";

type DoneSort = "latest" | "oldest";
const DONE_SORT_STORAGE_KEY = "design-tracker:my-tasks:done-sort";
const COLLAPSED_STORAGE_KEY = "design-tracker:my-tasks:collapsed-sections";
const DONE_COLLAPSED_STORAGE_KEY = "design-tracker:my-tasks:done-collapsed";

// Adapter so the project-scoped SectionBlock can render a personal section.
// SectionBlock only reads id/name from `section`; the rest of the Section
// fields are dummied out.
function toSectionShim(s: MyTaskSection): Section {
  return {
    id: s.id,
    project_id: "",
    name: s.name,
    position: s.position,
    created_at: s.created_at,
    created_by: null,
  };
}

export default function MyTasksPage() {
  const { data: tasks, isLoading: tasksLoading } = useMyTasks();
  const { data: sections = [], isLoading: sectionsLoading } = useMySections();
  const updateTask = useUpdateMyTask();
  const createSection = useCreateMySection();
  const renameSection = useRenameMySection();
  const reorderSection = useReorderMySection();
  const deleteSection = useDeleteMySection();

  const isLoading = tasksLoading || sectionsLoading;

  // Top-level rows: a task assigned to me shows as its own row even if it's
  // technically a subtask of something else — its parent might not be mine.
  const allTasks = tasks ?? [];

  const { openTasks, doneTasks } = useMemo(() => {
    const open: MyTaskRow[] = [];
    const done: MyTaskRow[] = [];
    for (const t of allTasks) {
      if (t.status === "done") done.push(t);
      else open.push(t);
    }
    return { openTasks: open, doneTasks: done };
  }, [allTasks]);

  const sortedSections = useMemo(
    () => [...sections].sort((a, b) => a.position - b.position),
    [sections]
  );

  // Group open tasks by my_section_id. Null my_position → top (new arrivals
  // appear above already-placed ones in the same bucket).
  const { unsectioned, bySection } = useMemo(() => {
    const us: MyTaskRow[] = [];
    const by = new Map<string, MyTaskRow[]>();
    for (const t of openTasks) {
      if (t.my_section_id) {
        const arr = by.get(t.my_section_id) ?? [];
        arr.push(t);
        by.set(t.my_section_id, arr);
      } else {
        us.push(t);
      }
    }
    const sortByMyPosition = (a: MyTaskRow, b: MyTaskRow) => {
      const ap = a.my_position;
      const bp = b.my_position;
      if (ap === null && bp === null) return a.created_at.localeCompare(b.created_at);
      if (ap === null) return -1;
      if (bp === null) return 1;
      return ap - bp;
    };
    us.sort(sortByMyPosition);
    for (const arr of by.values()) arr.sort(sortByMyPosition);
    return { unsectioned: us, bySection: by };
  }, [openTasks]);

  // Done sort
  const [doneSort, setDoneSort] = useState<DoneSort>(() => {
    if (typeof window === "undefined") return "latest";
    return localStorage.getItem(DONE_SORT_STORAGE_KEY) === "oldest"
      ? "oldest"
      : "latest";
  });
  useEffect(() => {
    try {
      localStorage.setItem(DONE_SORT_STORAGE_KEY, doneSort);
    } catch {
      // ignore
    }
  }, [doneSort]);

  const sortedDoneTasks = useMemo(() => {
    if (doneTasks.length === 0) return doneTasks;
    const arr = [...doneTasks];
    arr.sort((a, b) => {
      const aT = a.completed_at ?? a.created_at;
      const bT = b.completed_at ?? b.created_at;
      return doneSort === "latest" ? bT.localeCompare(aT) : aT.localeCompare(bT);
    });
    return arr;
  }, [doneTasks, doneSort]);

  // Collapsed section state
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(COLLAPSED_STORAGE_KEY);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {
      // ignore
    }
    return new Set();
  });
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...collapsedSet]));
    } catch {
      // ignore
    }
  }, [collapsedSet]);
  const toggleCollapsed = (id: string) =>
    setCollapsedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Done collapse state
  const [doneCollapsed, setDoneCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const raw = localStorage.getItem(DONE_COLLAPSED_STORAGE_KEY);
      return raw === null ? true : raw === "true";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(DONE_COLLAPSED_STORAGE_KEY, String(doneCollapsed));
    } catch {
      // ignore
    }
  }, [doneCollapsed]);

  // Section dialogs
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [renamingSection, setRenamingSection] = useState<MyTaskSection | null>(null);
  const [deletingSection, setDeletingSection] = useState<MyTaskSection | null>(null);

  // Task panel
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTaskId = searchParams.get("task");
  const selectedTask = allTasks.find((t) => t.id === selectedTaskId) ?? null;
  const panelOpen = selectedTask !== null;

  const { width: panelWidth, isResizing, onPointerDown } = useResizablePanel({
    defaultWidth: 600,
    min: 360,
    max: 1000,
  });

  const setSelectedTaskId = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("task", id);
    else next.delete("task");
    setSearchParams(next, { replace: true });
  };
  const closePanel = () => setSelectedTaskId(null);

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

  // Done section resizable height
  const {
    height: doneHeight,
    isResizing: doneResizing,
    onPointerDown: onDoneResize,
  } = useResizableHeight({
    storageKey: "design-tracker:my-tasks:done-height",
    defaultHeight: 240,
    min: 80,
    max: 600,
    collapseAt: 50,
    onCollapse: () => setDoneCollapsed(true),
  });

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeType = activeId?.startsWith("section-row:") ? "section" : "task";
  const activeTask =
    activeId && activeType === "task"
      ? openTasks.find((t) => t.id === activeId) ?? null
      : null;
  const activeSection =
    activeId && activeType === "section"
      ? sortedSections.find((s) => sectionRowId(s.id) === activeId) ?? null
      : null;

  useEffect(() => {
    if (!activeId) return;
    const prev = document.body.style.cursor;
    document.body.style.cursor = "grabbing";
    return () => {
      document.body.style.cursor = prev;
    };
  }, [activeId]);

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };
  const finishDrag = () => setActiveId(null);

  const onDragEnd = (event: DragEndEvent) => {
    finishDrag();
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    // -- Section reorder ------------------------------------------------
    const activeKind = active.data.current?.type;
    if (activeKind === "section") {
      const overKind = over.data.current?.type;
      if (overKind !== "section") return;
      const activeSectionId = active.data.current?.sectionId as string | undefined;
      const overSectionId = over.data.current?.sectionId as string | undefined;
      if (!activeSectionId || !overSectionId) return;

      const oldIdx = sortedSections.findIndex((s) => s.id === activeSectionId);
      const newIdxAmongAll = sortedSections.findIndex((s) => s.id === overSectionId);
      if (oldIdx === -1 || newIdxAmongAll === -1) return;

      const filtered = sortedSections.filter((s) => s.id !== activeSectionId);
      const overIdx = filtered.findIndex((s) => s.id === overSectionId);
      if (overIdx === -1) return;

      const placeAfter = newIdxAmongAll > oldIdx;
      let newPosition: number;
      if (placeAfter) {
        const next = filtered[overIdx + 1];
        const here = filtered[overIdx]!;
        newPosition = next ? (here.position + next.position) / 2 : here.position + 1024;
      } else {
        const prev = filtered[overIdx - 1];
        const here = filtered[overIdx]!;
        newPosition = prev ? (prev.position + here.position) / 2 : here.position - 1024;
      }

      const movedSection = sortedSections[oldIdx]!;
      if (movedSection.position !== newPosition) {
        reorderSection.mutate({ id: activeSectionId, position: newPosition });
      }
      return;
    }

    // -- Task reorder / cross-section move ------------------------------
    const movedTask = openTasks.find((t) => t.id === active.id);
    if (!movedTask) return;

    const overId = String(over.id);
    let targetSectionId: string | null;
    let droppedOnSection: boolean;
    if (overId.startsWith("section:")) {
      droppedOnSection = true;
      targetSectionId = overId === "section:null" ? null : overId.slice("section:".length);
    } else {
      droppedOnSection = false;
      const overTask = openTasks.find((t) => t.id === over.id);
      if (!overTask) return;
      targetSectionId = overTask.my_section_id ?? null;
    }

    // Tasks already in the target section, excluding the dragged one so its
    // own current my_position doesn't bias the midpoint math.
    const targetTasks = openTasks
      .filter(
        (t) => (t.my_section_id ?? null) === targetSectionId && t.id !== active.id
      )
      .sort((a, b) => {
        const ap = a.my_position ?? -Infinity;
        const bp = b.my_position ?? -Infinity;
        return ap - bp;
      });

    let newPosition: number;
    if (droppedOnSection) {
      const last = targetTasks[targetTasks.length - 1];
      newPosition = last?.my_position != null ? last.my_position + 1024 : 1024;
    } else {
      const overIdx = targetTasks.findIndex((t) => t.id === over.id);
      if (overIdx === -1) {
        const last = targetTasks[targetTasks.length - 1];
        newPosition = last?.my_position != null ? last.my_position + 1024 : 1024;
      } else {
        const sameSection = (movedTask.my_section_id ?? null) === targetSectionId;
        let placeAfter = false;
        if (sameSection) {
          const sourceTasks = openTasks
            .filter((t) => (t.my_section_id ?? null) === targetSectionId)
            .sort((a, b) => {
              const ap = a.my_position ?? -Infinity;
              const bp = b.my_position ?? -Infinity;
              return ap - bp;
            });
          const oldIdx = sourceTasks.findIndex((t) => t.id === active.id);
          const newIdxAmongAll = sourceTasks.findIndex((t) => t.id === over.id);
          placeAfter = newIdxAmongAll > oldIdx;
        }
        if (placeAfter) {
          const next = targetTasks[overIdx + 1];
          const here = targetTasks[overIdx]!;
          const hp = here.my_position;
          if (hp == null) {
            newPosition = 1024;
          } else {
            newPosition = next?.my_position != null ? (hp + next.my_position) / 2 : hp + 1024;
          }
        } else {
          const prev = targetTasks[overIdx - 1];
          const here = targetTasks[overIdx]!;
          const hp = here.my_position;
          if (hp == null) {
            newPosition = -1024;
          } else {
            newPosition = prev?.my_position != null ? (prev.my_position + hp) / 2 : hp - 1024;
          }
        }
      }
    }

    const fieldsChanged =
      (movedTask.my_section_id ?? null) !== targetSectionId ||
      movedTask.my_position !== newPosition;
    if (fieldsChanged) {
      updateTask.mutate({
        id: movedTask.id,
        patch: { my_section_id: targetSectionId, my_position: newPosition },
      });
    }
  };

  const renderRow = (task: Task) => {
    // SectionBlock types renderRow with Task; in this view every task is
    // actually a MyTaskRow (carries the joined `project`) so we look it up
    // by id to recover the project context for the assignee avatar etc.
    const my = allTasks.find((t) => t.id === task.id);
    return (
      <SortableTaskRow
        key={task.id}
        task={task}
        sectionId={task.my_section_id ?? null}
      >
        <TaskRow
          task={task}
          workspaceId={my?.project?.workspace_id}
          selected={task.id === selectedTaskId}
          onSelect={() =>
            setSelectedTaskId(task.id === selectedTaskId ? null : task.id)
          }
        />
      </SortableTaskRow>
    );
  };

  const activeCount = openTasks.length;
  const empty =
    !isLoading && allTasks.length === 0 && sortedSections.length === 0;

  return (
    <div className="relative h-full flex">
      <section className="flex-1 min-w-0 flex flex-col">
        <header className="border-b px-6 h-14 flex items-center gap-3 shrink-0">
          <h1 className="text-base font-semibold">My tasks</h1>
          {activeCount > 0 && (
            <span className="text-sm text-muted-foreground">{activeCount}</span>
          )}
          <div className="ml-auto">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => setAddSectionOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add section
            </Button>
          </div>
        </header>

        {isLoading ? (
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-3/4" />
          </div>
        ) : empty ? (
          <EmptyState onAddSection={() => setAddSectionOpen(true)} />
        ) : (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragCancel={finishDrag}
            >
              <div className="flex-1 min-h-0 overflow-y-auto">
                {/* Unsectioned tasks at top — same SectionBlock with no
                    header, hideAddTask since this view is view-only. */}
                {unsectioned.length > 0 && (
                  <SectionBlock
                    section={null}
                    tasks={unsectioned}
                    collapsed={false}
                    onToggleCollapsed={() => undefined}
                    onRenameClick={() => undefined}
                    onDeleteClick={() => undefined}
                    onAddTask={() => undefined}
                    renderRow={renderRow}
                    hideAddTask
                  />
                )}

                <SortableContext
                  items={sortedSections.map((s) => sectionRowId(s.id))}
                  strategy={verticalListSortingStrategy}
                >
                  {sortedSections.map((section) => (
                    <SortableSection key={section.id} sectionId={section.id}>
                      {({ dragListeners }) => (
                        <SectionBlock
                          section={toSectionShim(section)}
                          tasks={bySection.get(section.id) ?? []}
                          collapsed={collapsedSet.has(section.id)}
                          onToggleCollapsed={() => toggleCollapsed(section.id)}
                          onRenameClick={() => setRenamingSection(section)}
                          onDeleteClick={() => setDeletingSection(section)}
                          onAddTask={() => undefined}
                          renderRow={renderRow}
                          dragListeners={dragListeners}
                          hideAddTask
                        />
                      )}
                    </SortableSection>
                  ))}
                </SortableContext>
              </div>

              <DragOverlay>
                {activeTask ? (
                  <div className="rounded-md bg-background ring-1 ring-foreground/10 shadow-2xl rotate-1 cursor-grabbing">
                    <TaskRow
                      task={activeTask}
                      workspaceId={activeTask.project?.workspace_id}
                      selected={false}
                      onSelect={() => undefined}
                    />
                  </div>
                ) : activeSection ? (
                  <div className="rounded-md bg-background ring-1 ring-foreground/10 shadow-2xl px-3 py-1.5 flex items-center gap-1 rotate-1 cursor-grabbing">
                    <GripVertical
                      className="h-3.5 w-3.5 text-muted-foreground"
                      aria-hidden
                    />
                    <h3 className="text-lg font-semibold">{activeSection.name}</h3>
                    <span className="text-xs text-muted-foreground ml-1">
                      {(bySection.get(activeSection.id) ?? []).length}
                    </span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            {doneTasks.length > 0 && (
              <div
                className={cn(
                  "shrink-0 flex flex-col bg-background",
                  doneCollapsed && "border-t"
                )}
                style={doneCollapsed ? undefined : { height: doneHeight }}
              >
                {!doneCollapsed && (
                  <button
                    type="button"
                    aria-label="Resize Done section"
                    onPointerDown={onDoneResize}
                    className="group h-2 w-full cursor-row-resize shrink-0 focus:outline-none bg-[#F5F7FA]"
                  >
                    <span
                      className={cn(
                        "block w-full h-0.5 -mt-px transition-colors",
                        doneResizing
                          ? "bg-primary/60"
                          : "bg-border group-hover:bg-primary/40"
                      )}
                    />
                  </button>
                )}
                <div
                  className={cn(
                    "shrink-0 flex items-center gap-1 px-3 bg-[#F5F7FA] border-b",
                    doneCollapsed ? "h-[68px]" : "py-1.5"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setDoneCollapsed((c) => !c)}
                    className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground rounded"
                    aria-label={doneCollapsed ? "Expand Done section" : "Collapse Done section"}
                  >
                    {doneCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <h2 className="text-lg font-semibold">Done</h2>
                  <span className="text-xs text-muted-foreground ml-1">
                    {doneTasks.length}
                  </span>
                  {!doneCollapsed && (
                    <div className="ml-auto">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                            aria-label="Sort done tasks"
                          >
                            {doneSort === "latest" ? (
                              <ArrowDownNarrowWide className="h-3 w-3" aria-hidden />
                            ) : (
                              <ArrowUpNarrowWide className="h-3 w-3" aria-hidden />
                            )}
                            {doneSort === "latest" ? "Latest first" : "Oldest first"}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setDoneSort("latest")}>
                            <Check
                              className={cn(
                                "mr-2 h-3.5 w-3.5",
                                doneSort === "latest" ? "opacity-100" : "opacity-0"
                              )}
                            />
                            Latest first
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setDoneSort("oldest")}>
                            <Check
                              className={cn(
                                "mr-2 h-3.5 w-3.5",
                                doneSort === "oldest" ? "opacity-100" : "opacity-0"
                              )}
                            />
                            Oldest first
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
                {!doneCollapsed && (
                  <ul className="flex-1 min-h-0 overflow-y-auto divide-y-0">
                    {sortedDoneTasks.map((task) => (
                      <li key={task.id}>
                        <TaskRow
                          task={task}
                          workspaceId={task.project?.workspace_id}
                          selected={task.id === selectedTaskId}
                          onSelect={() =>
                            setSelectedTaskId(
                              task.id === selectedTaskId ? null : task.id
                            )
                          }
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}

        <AddSectionDialog
          open={addSectionOpen}
          onOpenChange={setAddSectionOpen}
          onSubmit={(name) => createSection.mutate(name)}
        />
        <RenameSectionDialog
          section={renamingSection ? toSectionShim(renamingSection) : null}
          open={!!renamingSection}
          onOpenChange={(open) => !open && setRenamingSection(null)}
          onSubmit={(id, name) => renameSection.mutate({ id, name })}
        />
        <DeleteSectionDialog
          section={deletingSection ? toSectionShim(deletingSection) : null}
          open={!!deletingSection}
          onOpenChange={(open) => !open && setDeletingSection(null)}
          onConfirm={(id) => {
            deleteSection.mutate(id);
            setDeletingSection(null);
          }}
        />
      </section>

      <aside
        aria-hidden={!panelOpen}
        style={{ width: panelOpen ? panelWidth : 0 }}
        className={cn(
          "relative shrink-0 overflow-hidden border-l bg-background",
          !isResizing && "transition-[width] duration-200 ease-out",
          panelOpen && "shadow-[-12px_0_28px_-16px_rgba(0,0,0,0.18)]"
        )}
      >
        <div style={{ width: panelWidth }} className="h-full">
          {selectedTask && (
            <TaskDetailPanel
              key={selectedTask.id}
              task={selectedTask}
              workspaceId={selectedTask.project?.workspace_id}
              onClose={closePanel}
            />
          )}
        </div>
      </aside>

      {panelOpen && (
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
    </div>
  );
}

function EmptyState({ onAddSection }: { onAddSection: () => void }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-6 py-12 gap-3">
      <p className="text-sm font-medium">No tasks assigned to you yet.</p>
      <p className="text-xs text-muted-foreground max-w-[280px]">
        When someone assigns you a task — in any workspace — it'll show up
        here. You can create your own sections to organize them.
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onAddSection}>
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Add section
      </Button>
    </div>
  );
}

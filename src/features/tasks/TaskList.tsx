import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  Check,
  ChevronDown,
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AddSectionDialog,
  DeleteSectionDialog,
  RenameSectionDialog,
} from "@/features/sections/SectionDialogs";
import { SectionBlock } from "@/features/sections/SectionBlock";
import { SortableSection, sectionRowId } from "@/features/sections/SortableSection";
import { ChevronRight, GripVertical } from "lucide-react";

import { TaskListHeader } from "./TaskListHeader";
import { defaultFilters, matchesFilters, type Filters } from "./taskFilters";
import { SortableTaskRow } from "@/features/tasks/SortableTaskRow";
import {
  useCreateSection,
  useDeleteSection,
  useRenameSection,
  useReorderSection,
  useSections,
} from "@/features/sections/useSections";
import { useResizableHeight } from "@/hooks/useResizableHeight";
import { cn } from "@/lib/utils";
import type { Section, Task } from "@/types/database";

import { TaskRow } from "./TaskRow";
import { useCreateTask, useTasks, useUpdateTask } from "./useTasks";

type DoneSort = "latest" | "oldest";
const DONE_SORT_STORAGE_KEY = "design-tracker:done-sort";
const COLLAPSED_STORAGE_PREFIX = "design-tracker:collapsed-sections:";
const DONE_COLLAPSED_STORAGE_PREFIX = "design-tracker:done-collapsed:";

export function TaskList({
  projectId,
  workspaceId,
}: {
  projectId: string;
  workspaceId: string | undefined;
}) {
  const { data: tasks, isLoading } = useTasks(projectId);
  const { data: sections = [] } = useSections(projectId);
  const createTask = useCreateTask(projectId);
  const updateTask = useUpdateTask(projectId);
  const createSection = useCreateSection(projectId);
  const renameSection = useRenameSection(projectId);
  const reorderSection = useReorderSection(projectId);
  const deleteSection = useDeleteSection(projectId);

  // useTasks returns the whole project tree; this view shows top-level only
  // and aggregates direct-child counts for the subtask badge on each row.
  const { topLevel, subtaskCounts } = useMemo(() => {
    const counts = new Map<string, { total: number; done: number }>();
    const top: Task[] = [];
    for (const t of tasks ?? []) {
      if (t.parent_task_id) {
        const cur = counts.get(t.parent_task_id) ?? { total: 0, done: 0 };
        cur.total += 1;
        if (t.status === "done") cur.done += 1;
        counts.set(t.parent_task_id, cur);
      } else {
        top.push(t);
      }
    }
    return { topLevel: top, subtaskCounts: counts };
  }, [tasks]);

  // Column filters apply to both the open list and the Done dock so the
  // user's mental model stays consistent (e.g., filtering to a specific
  // assignee hides everything they didn't touch, completed or not).
  const [filters, setFilters] = useState<Filters>(defaultFilters);

  // Split into open (todo / in_progress) and done — filtered.
  const { openTasks, doneTasks } = useMemo(() => {
    const open: Task[] = [];
    const done: Task[] = [];
    for (const t of topLevel) {
      if (!matchesFilters(t, filters)) continue;
      if (t.status === "done") done.push(t);
      else open.push(t);
    }
    return { openTasks: open, doneTasks: done };
  }, [topLevel, filters]);

  // Stable position-sorted section list. Optimistic-cache reorders won't
  // be returned in the new order, so we sort client-side.
  const sortedSections = useMemo(
    () => [...sections].sort((a, b) => a.position - b.position),
    [sections]
  );

  // Group open tasks by section_id. Un-sectioned ones float to the top.
  // Sorting by position inside each group means optimistic cache updates
  // (which append, not insert) still render in the right order after a drag.
  const { unsectioned, bySection } = useMemo(() => {
    const us: Task[] = [];
    const by = new Map<string, Task[]>();
    for (const t of openTasks) {
      if (t.section_id) {
        const arr = by.get(t.section_id) ?? [];
        arr.push(t);
        by.set(t.section_id, arr);
      } else {
        us.push(t);
      }
    }
    us.sort((a, b) => a.position - b.position);
    for (const arr of by.values()) arr.sort((a, b) => a.position - b.position);
    return { unsectioned: us, bySection: by };
  }, [openTasks]);

  // Sort
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

  // Collapsed-section state, persisted per project.
  const collapseKey = `${COLLAPSED_STORAGE_PREFIX}${projectId}`;
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(collapseKey);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {
      // ignore
    }
    return new Set();
  });
  useEffect(() => {
    try {
      localStorage.setItem(collapseKey, JSON.stringify([...collapsedSet]));
    } catch {
      // ignore
    }
  }, [collapsedSet, collapseKey]);
  // Done-section collapse state, persisted per project.
  const doneCollapsedKey = `${DONE_COLLAPSED_STORAGE_PREFIX}${projectId}`;
  const [doneCollapsed, setDoneCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(doneCollapsedKey) === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(doneCollapsedKey, String(doneCollapsed));
    } catch {
      // ignore
    }
  }, [doneCollapsed, doneCollapsedKey]);

  const toggleCollapsed = (id: string) =>
    setCollapsedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Top inline-add (for the un-sectioned group). Always visible; the combo
  // button focuses it.
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Add-section dialog + rename/delete state
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [renamingSection, setRenamingSection] = useState<Section | null>(null);
  const [deletingSection, setDeletingSection] = useState<Section | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTaskId = searchParams.get("task");

  const setSelectedTaskId = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("task", id);
    else next.delete("task");
    setSearchParams(next, { replace: true });
  };

  // `/` shortcut → focus the top inline-add input.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const submitNewTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    setDraft("");
    // Keep focus in the input for rapid entry; the detail panel opens
    // alongside but doesn't pull focus.
    inputRef.current?.focus();
    try {
      const task = await createTask.mutateAsync({ title });
      setSelectedTaskId(task.id);
    } catch {
      // Toast was already fired by the mutation's onError.
    }
  };

  // Bottom-docked Done section height.
  const {
    height: doneHeight,
    isResizing: doneResizing,
    onPointerDown: onDoneResize,
  } = useResizableHeight({
    storageKey: "design-tracker:done-section-height",
    defaultHeight: 240,
    min: 80,
    max: 600,
    // Drag clearly past min → auto-collapse. 30px buffer below min so a
    // normal "shrink to min" doesn't trip it; the user really has to pull
    // the handle down further to dismiss.
    collapseAt: 50,
    onCollapse: () => setDoneCollapsed(true),
  });

  // DnD: 8px activation distance keeps clicks intact (anything under that
  // is treated as a click and the row's onClick still fires).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Track what's being dragged so the DragOverlay can render the matching
  // preview. We also force a global grabbing cursor while a drag is in
  // flight — much more obvious feedback than relying on the source row.
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

  // Resolve the target section + new position for a drop event, then mutate.
  const onDragEnd = (event: DragEndEvent) => {
    finishDrag();
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    // -- Section reorder ------------------------------------------------
    const activeType = active.data.current?.type;
    if (activeType === "section") {
      const overType = over.data.current?.type;
      // Sections can only be dropped on other sections — ignore drops onto
      // a task or a section's droppable-zone-as-task-target.
      if (overType !== "section") return;
      const activeSectionId = active.data.current?.sectionId as string | undefined;
      const overSectionId = over.data.current?.sectionId as string | undefined;
      if (!activeSectionId || !overSectionId) return;

      const sorted = sortedSections;
      const oldIdx = sorted.findIndex((s) => s.id === activeSectionId);
      const newIdxAmongAll = sorted.findIndex((s) => s.id === overSectionId);
      if (oldIdx === -1 || newIdxAmongAll === -1) return;

      const filtered = sorted.filter((s) => s.id !== activeSectionId);
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

      const activeSection = sorted[oldIdx]!;
      if (activeSection.position !== newPosition) {
        reorderSection.mutate({ id: activeSectionId, position: newPosition });
      }
      return;
    }

    // -- Task reorder / cross-section move -----------------------------
    const activeTask = openTasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    // Where did we drop? Either a section's empty container (over.id starts
    // with "section:") or another task (over.id is its uuid). Read the
    // section id from the over item's data or decode the section: prefix.
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
      targetSectionId = overTask.section_id ?? null;
    }

    // Tasks already in the target section, sorted, with the dragged task
    // excluded (so its current position doesn't bias the midpoint math).
    const targetTasks = openTasks
      .filter((t) => (t.section_id ?? null) === targetSectionId && t.id !== active.id)
      .sort((a, b) => a.position - b.position);

    let newPosition: number;
    if (droppedOnSection || !over.id) {
      // Dropped on the section container → append at the end.
      const last = targetTasks[targetTasks.length - 1];
      newPosition = last ? last.position + 1024 : 1024;
    } else {
      const overIdx = targetTasks.findIndex((t) => t.id === over.id);
      if (overIdx === -1) {
        const last = targetTasks[targetTasks.length - 1];
        newPosition = last ? last.position + 1024 : 1024;
      } else {
        const sameSection = (activeTask.section_id ?? null) === targetSectionId;
        // Same-section reorder: figure out whether we're moving down (place
        // after the over item) or up (place before). Cross-section drops
        // always place before the over item.
        let placeAfter = false;
        if (sameSection) {
          const sourceTasks = openTasks
            .filter((t) => (t.section_id ?? null) === targetSectionId)
            .sort((a, b) => a.position - b.position);
          const oldIdx = sourceTasks.findIndex((t) => t.id === active.id);
          const newIdxAmongAll = sourceTasks.findIndex((t) => t.id === over.id);
          placeAfter = newIdxAmongAll > oldIdx;
        }
        if (placeAfter) {
          const next = targetTasks[overIdx + 1];
          const here = targetTasks[overIdx]!;
          newPosition = next ? (here.position + next.position) / 2 : here.position + 1024;
        } else {
          const prev = targetTasks[overIdx - 1];
          const here = targetTasks[overIdx]!;
          newPosition = prev ? (prev.position + here.position) / 2 : here.position - 1024;
        }
      }
    }

    if (
      (activeTask.section_id ?? null) !== targetSectionId ||
      activeTask.position !== newPosition
    ) {
      updateTask.mutate({
        id: activeTask.id,
        patch: { section_id: targetSectionId, position: newPosition },
      });
    }
  };

  const renderRow = (task: Task) => {
    const counts = subtaskCounts.get(task.id);
    return (
      <SortableTaskRow key={task.id} task={task}>
        <TaskRow
          task={task}
          workspaceId={workspaceId}
          selected={task.id === selectedTaskId}
          // Toggle: clicking an already-selected row closes the panel.
          onSelect={() =>
            setSelectedTaskId(task.id === selectedTaskId ? null : task.id)
          }
          subtaskTotal={counts?.total ?? 0}
          subtaskDone={counts?.done ?? 0}
        />
      </SortableTaskRow>
    );
  };

  // Shared wrapper for inline-add submissions: create, then open the new
  // task's detail panel.
  const addTaskAndOpen = async (title: string, sectionId: string | null) => {
    try {
      const task = await createTask.mutateAsync({
        title,
        sectionId: sectionId ?? undefined,
      });
      setSelectedTaskId(task.id);
    } catch {
      // Toast already fired in the mutation's onError.
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Top: combo button beside the inline-add input, single row. */}
      <div className="shrink-0 border-b bg-background px-3 py-3">
        <form onSubmit={submitNewTask} className="flex items-center gap-2">
          <AddTaskCombo
            onAddTask={() => inputRef.current?.focus()}
            onAddSection={() => setAddSectionOpen(true)}
          />
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a task — press Enter   ( / to focus )"
            className="h-9 flex-1"
            autoComplete="off"
          />
        </form>
      </div>

      {isLoading ? (
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-3/4" />
        </div>
      ) : topLevel.length === 0 && sections.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center px-6 py-16 text-center text-sm text-muted-foreground">
          No tasks yet. Use the input above to add your first one.
        </div>
      ) : (
        <>
          <TaskListHeader
            workspaceId={workspaceId}
            filters={filters}
            onChange={setFilters}
          />
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={finishDrag}
          >
            <div className="flex-1 min-h-0 overflow-y-auto">
              {/* Un-sectioned tasks first */}
              {unsectioned.length > 0 && (
                <SectionBlock
                  section={null}
                  tasks={unsectioned}
                  collapsed={false}
                  onToggleCollapsed={() => undefined}
                  onRenameClick={() => undefined}
                  onDeleteClick={() => undefined}
                  onAddTask={(title) => addTaskAndOpen(title, null)}
                  renderRow={renderRow}
                />
              )}

              {/* User-defined sections — wrapped in their own
                  SortableContext so each section row is independently
                  draggable. Tasks live in nested SortableContexts inside
                  each SectionBlock. */}
              <SortableContext
                items={sortedSections.map((s) => sectionRowId(s.id))}
                strategy={verticalListSortingStrategy}
              >
                {sortedSections.map((section) => (
                  <SortableSection key={section.id} sectionId={section.id}>
                    {({ dragListeners }) => (
                      <SectionBlock
                        section={section}
                        tasks={bySection.get(section.id) ?? []}
                        collapsed={collapsedSet.has(section.id)}
                        onToggleCollapsed={() => toggleCollapsed(section.id)}
                        onRenameClick={() => setRenamingSection(section)}
                        onDeleteClick={() => setDeletingSection(section)}
                        onAddTask={(title) => addTaskAndOpen(title, section.id)}
                        renderRow={renderRow}
                        dragListeners={dragListeners}
                      />
                    )}
                  </SortableSection>
                ))}
              </SortableContext>
            </div>

            {/* Lifted "ghost" that follows the cursor. Source row keeps a
                placeholder slot so the user sees where it'll land. */}
            <DragOverlay>
              {activeTask ? (
                <div className="rounded-md bg-background ring-1 ring-foreground/10 shadow-2xl rotate-1 cursor-grabbing">
                  <TaskRow
                    task={activeTask}
                    workspaceId={workspaceId}
                    selected={false}
                    onSelect={() => undefined}
                    subtaskTotal={subtaskCounts.get(activeTask.id)?.total ?? 0}
                    subtaskDone={subtaskCounts.get(activeTask.id)?.done ?? 0}
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
                // Collapsed: 1px border-t matches the sidebar's footer divider.
                // Expanded: no border — the resize handle's indicator IS the
                // visible top edge so the drag line sits exactly on it.
                doneCollapsed && "border-t"
              )}
              // When collapsed, let the wrapper auto-fit the header height;
              // when expanded, use the user-resizable height.
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
                      // 2px tall so it visually replaces the border-t-2 we
                      // used to render. `bg-border` matches the idle line
                      // colour; turns primary on hover/drag. `-mt-px` lifts
                      // it one pixel up so it aligns with the section's
                      // visual top edge.
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
                  // Collapsed: match the sidebar user-info footer height.
                  // That block's content stack (text-sm + text-xs ≈ 36px) +
                  // inner button p-2 + outer p-2 ≈ 68px.
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
                  {sortedDoneTasks.map((task) => renderRow(task))}
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
        section={renamingSection}
        open={!!renamingSection}
        onOpenChange={(open) => !open && setRenamingSection(null)}
        onSubmit={(id, name) => renameSection.mutate({ id, name })}
      />
      <DeleteSectionDialog
        section={deletingSection}
        open={!!deletingSection}
        onOpenChange={(open) => !open && setDeletingSection(null)}
        onConfirm={(id) => {
          deleteSection.mutate(id);
          setDeletingSection(null);
        }}
      />
    </div>
  );
}

// Split combo button at the top of the task area: primary "Add task" action
// plus a chevron that opens a menu for "Add section".
function AddTaskCombo({
  onAddTask,
  onAddSection,
}: {
  onAddTask: () => void;
  onAddSection: () => void;
}) {
  return (
    <div className="inline-flex h-9 rounded-md border bg-background overflow-hidden">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-full rounded-none border-r"
        onClick={onAddTask}
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        Add task
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-full w-9 rounded-none"
            aria-label="More add options"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={onAddTask}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            Add task
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onAddSection}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            Add section
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

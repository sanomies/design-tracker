import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  Check,
} from "lucide-react";

import {
  IconChevronDown,
  IconCirclePlus,
  IconSection,
} from "@/components/icons/figma";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  closestCorners,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";

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

import { TaskListHeader } from "./TaskListHeader";
import { defaultFilters, matchesFilters, type Filters } from "./taskFilters";
import { type SortState } from "./taskColumns";
import { buildSortComparator } from "./taskSort";
import { useCatalog } from "./CatalogProvider";
import { useWorkspaceMembers } from "@/features/workspaces/useWorkspaceMembers";
import { SortableTaskRow } from "@/features/tasks/SortableTaskRow";
import {
  useCreateSection,
  useUndoableDeleteSection,
  useUndoableRenameSection,
  useReorderSection,
  useSections,
} from "@/features/sections/useSections";
import { useResizableHeight } from "@/hooks/useResizableHeight";
import { cn } from "@/lib/utils";
import type { Section, Task } from "@/types/database";

import { toast } from "sonner";

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

import { TaskContextMenu } from "./TaskContextMenu";
import { TaskRow } from "./TaskRow";
import {
  useCreateTask,
  useTasks,
  useUndoableDeleteTask,
  useUpdateTask,
} from "./useTasks";

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
  const catalog = useCatalog();
  const createTask = useCreateTask(projectId);
  const updateTask = useUpdateTask(projectId);
  // Task delete uses the undoable variant: 6s toast with Undo button,
  // DB call deferred so undo restores from cache without touching the
  // DB (cascaded comments/subtasks stay intact).
  const undoableDeleteTask = useUndoableDeleteTask(projectId);
  const createSection = useCreateSection(projectId);
  const undoableRenameSection = useUndoableRenameSection(projectId);
  const reorderSection = useReorderSection(projectId);
  const undoableDeleteSection = useUndoableDeleteSection(projectId);

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

  // Column sort. null = no sort, fall back to manual position. Sort is
  // applied within each section, not across them, so sections still feel
  // like distinct groups.
  const [sort, setSort] = useState<SortState>(null);
  const { data: members = [] } = useWorkspaceMembers(workspaceId);

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
  // Default ordering is by `position` so optimistic cache updates (which
  // append, not insert) still land in the right slot after a drag. When
  // a column sort is active it overrides position within each group.
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
    const sortCmp = buildSortComparator(sort, members, catalog);
    const finalCmp = sortCmp ?? ((a: Task, b: Task) => a.position - b.position);
    us.sort(finalCmp);
    for (const arr of by.values()) arr.sort(finalCmp);
    return { unsectioned: us, bySection: by };
  }, [openTasks, sort, members, catalog]);

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

  // "Add task" → create an empty-titled task and immediately open its
  // detail panel. The panel's title field auto-enters edit mode when the
  // title is blank, so the user can start typing right away.
  //
  // Default destination is the "Unassigned" section if one exists (new
  // projects are seeded with it, and the 0019 migration backfills it on
  // older ones). If the user renamed/deleted it, fall back to the first
  // section by position; if there are no sections at all, the task lands
  // in the headerless bucket.
  const handleAddTask = async () => {
    const unassigned = sortedSections.find(
      (s) => s.name.trim().toLowerCase() === "unassigned"
    );
    const targetSectionId =
      unassigned?.id ?? sortedSections[0]?.id ?? null;
    try {
      const task = await createTask.mutateAsync({
        title: "",
        sectionId: targetSectionId,
      });
      setSelectedTaskId(task.id);
    } catch {
      // Toast was already fired by the mutation's onError.
    }
  };

  // ---- Right-click context menu ----
  // `contextMenu` carries both the task that was right-clicked and the
  // viewport coordinates at which to anchor the menu. `pendingDelete`
  // backs the AlertDialog confirm; the Delete action in the menu sets
  // it, the dialog's Action button performs the actual deletion.
  const [contextMenu, setContextMenu] = useState<
    | { task: Task; x: number; y: number }
    | null
  >(null);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);

  const handleRowContextMenu = (e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    setContextMenu({ task, x: e.clientX, y: e.clientY });
  };

  // Event-delegation listener attached at the document level in the
  // CAPTURE phase, so it fires before any descendant listener (incl.
  // dnd-kit's sortable wrapper) can interfere. We walk up from
  // `e.target` to find the closest `[data-task-id]` element, then
  // resolve the task by id and open the menu at the cursor.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const rowEl = target?.closest<HTMLElement>("[data-task-id]");
      if (!rowEl) return;
      const taskId = rowEl.dataset.taskId;
      if (!taskId) return;
      const task = (tasks ?? []).find((t) => t.id === taskId);
      if (!task) return;
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ task, x: e.clientX, y: e.clientY });
    };
    document.addEventListener("contextmenu", handler, { capture: true });
    return () =>
      document.removeEventListener("contextmenu", handler, { capture: true });
  }, [tasks]);

  const duplicateTask = async (task: Task) => {
    try {
      const created = await createTask.mutateAsync({
        title: task.title,
        sectionId: task.section_id,
      });
      // Copy the rest of the task's fields onto the freshly created row.
      // useCreateTask only seeds title/section; everything else is
      // applied as a follow-up patch so the optimistic insert still
      // appears immediately.
      const patch: Partial<Task> = {
        description: task.description,
        assignee_id: task.assignee_id,
        due_date: task.due_date,
        priority: task.priority,
        publication: task.publication,
      };
      // Skip the patch if everything is empty — saves a no-op write.
      if (Object.values(patch).some((v) => v !== null && v !== undefined)) {
        updateTask.mutate({ id: created.id, patch });
      }
      setSelectedTaskId(created.id);
    } catch {
      // Toast already fired by the mutation's onError.
    }
  };

  const toggleStatus = (task: Task) => {
    const next = task.status === "done" ? "todo" : "done";
    updateTask.mutate({ id: task.id, patch: { status: next } });
  };

  const copyTaskLink = async (task: Task) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("task", task.id);
      await navigator.clipboard.writeText(url.toString());
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    // The undoable delete fires the toast immediately and defers the
    // actual DB call by 6s, so this returns synchronously. If the task
    // being deleted is the one open in the detail panel, close it too —
    // its row is already gone from the cache.
    undoableDeleteTask(pendingDelete);
    if (selectedTaskId === pendingDelete.id) setSelectedTaskId(null);
    setPendingDelete(null);
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

  // Active id while dragging — backs the DragOverlay's lifted preview.
  // The "row follows the cursor" pattern (no overlay) jittered inside
  // nested layouts here, so the source row stays in place as a dimmed
  // slot and the overlay carries the visible motion.
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

  // Collision detection per active type.
  //
  // - Tasks use closestCorners (corner-to-corner) — stable for similar-
  //   sized rows, picks the right neighbour at row boundaries.
  // - Sections use closestCenter, but with the candidate droppables
  //   filtered down to ONLY the section-row sortables. Otherwise the
  //   default candidate set is "every droppable in the DndContext",
  //   which here includes every task sortable plus each section's
  //   container droppable ("section:<id>"). Those non-section-row
  //   droppables sit inside the section's bounding box, so closestCenter
  //   often picks one of THEM as `over` instead of a sibling section
  //   row — and when over.id isn't in the section-row SortableContext's
  //   items array, the strategy can't shift the other sections to make
  //   room. Filtering keeps the comparison between siblings only.
  const collisionDetection: CollisionDetection = (args) => {
    const activeType = args.active.data.current?.type;
    if (activeType === "section") {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((d) => {
          const id = typeof d.id === "string" ? d.id : String(d.id);
          return id.startsWith("section-row:");
        }),
      });
    }
    return closestCorners(args);
  };

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
          onContextMenu={handleRowContextMenu}
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
      {/* Top action row — two pill buttons. No inline input: "Add task"
          creates an empty task and opens its detail panel directly.
          `pt-2` lands the 8px gap below the page header per Figma. */}
      <div className="shrink-0 bg-background px-4 pb-4 pt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={handleAddTask}
          disabled={createTask.isPending || !projectId}
          className="inline-flex items-center gap-2 rounded-full bg-foreground pl-2 pr-3 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
        >
          <IconCirclePlus className="h-6 w-6" />
          Add task
        </button>
        <button
          type="button"
          onClick={() => setAddSectionOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-[#DEDFE0] bg-white pl-2 pr-3 py-2 text-sm font-medium text-foreground hover:bg-[#EDF2F4] transition-colors shrink-0"
        >
          <IconSection className="h-6 w-6" />
          Add Section
        </button>
      </div>

      {isLoading ? (
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-3/4" />
        </div>
      ) : topLevel.length === 0 && sections.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center px-6 py-16 text-center text-sm text-muted-foreground">
          No tasks yet. Click <span className="font-semibold">Add task</span> above to create one.
        </div>
      ) : (
        <>
          <DndContext
            sensors={sensors}
            // Per-active strategy — see `collisionDetection` above.
            collisionDetection={collisionDetection}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={finishDrag}
          >
            <div className="flex-1 min-h-0 overflow-y-auto">
              {/* Inner wrapper sizes to the widest row (`w-max`) but never
                  narrower than the viewport (`min-w-full`). This gives every
                  row + the header ONE shared content width, so the row
                  separators and the header background span the full
                  horizontal scroll instead of stopping at the viewport edge
                  (which made the dividers look broken when scrolled right). */}
              <div className="w-max min-w-full">
              {/* Header lives INSIDE the scroll container so it shares the
                  same width as the rows below — when the scrollbar takes
                  width, both shrink together and the column dividers stay
                  pixel-aligned. `sticky top-0` keeps it pinned at the top. */}
              <div className="sticky top-0 z-20">
                <TaskListHeader
                  workspaceId={workspaceId}
                  filters={filters}
                  onChange={setFilters}
                  sort={sort}
                  onSortChange={setSort}
                />
              </div>
              {/* Un-sectioned tasks first — their own SectionBlock
                  carries the inner task SortableContext. */}
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

              {/* Section reorder lives in its OWN SortableContext that
                  only knows about section row IDs — separate from each
                  section's internal task context. Unifying them caused
                  compounding transforms (each task's transform stacked
                  on top of its section's transform), which read as
                  jitter / jump-back during drag. */}
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
            </div>

            {/* Lifted "ghost" that follows the cursor. The source row /
                section keeps its slot (dimmed + dashed) so the user
                sees exactly where the item will land if they cancel. */}
            <DragOverlay>
              {activeTask ? (
                // `[&_*]:!cursor-grabbing` forces every descendant of
                // the overlay clone to inherit the grabbing cursor —
                // otherwise TaskRow's inner `cursor-pointer` (used to
                // signal "row is clickable" in the list) wins and the
                // preview shows the wrong cursor mid-drag.
                <div className="rounded-md bg-background ring-1 ring-foreground/10 shadow-2xl cursor-grabbing [&_*]:!cursor-grabbing">
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
                <div className="rounded-md bg-background ring-1 ring-foreground/10 shadow-2xl px-3 py-1.5 flex items-center gap-1 cursor-grabbing [&_*]:!cursor-grabbing">
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
              // Redesigned Done section per Figma: a flat gray block
              // (`#F6F9F9`) with a single top border, full panel width
              // — no card / rounded corners / margins. Header chevron is
              // intentionally 24×24, larger than the 18×18 chevrons on
              // the inline To Do / In Progress section headers.
              //
              // `relative` so the resize handle below can be absolute-
              // positioned to straddle the section's top border exactly
              // (mirrors the right-panel resize pattern in ProjectView).
              className="relative shrink-0 flex flex-col bg-[#F6F9F9] border-t border-[#DEDFE0]"
              // When collapsed, let the wrapper auto-fit the header height;
              // when expanded, use the user-resizable height.
              style={doneCollapsed ? undefined : { height: doneHeight }}
            >
              {!doneCollapsed && (
                // 8px hit target straddling the section's top edge — 4px
                // above the border, 4px below. The 1px indicator sits
                // exactly on the border line, so on hover/drag the line
                // just changes color (no extra thickness, no offset).
                // Matches the right-panel handle in ProjectView.
                <button
                  type="button"
                  aria-label="Resize Done section"
                  onPointerDown={onDoneResize}
                  className="group absolute inset-x-0 top-0 -translate-y-1/2 z-10 h-2 cursor-row-resize focus:outline-none bg-transparent flex items-center"
                >
                  <span
                    className={cn(
                      "block w-full h-px transition-colors",
                      doneResizing
                        ? "bg-primary/60"
                        : "bg-transparent group-hover:bg-primary/40"
                    )}
                  />
                </button>
              )}
              <div className="group shrink-0 flex items-center gap-2 mx-2 px-2 py-2 hover:bg-[#EDF2F4]/60 rounded-lg transition-colors">
                <button
                  type="button"
                  onClick={() => setDoneCollapsed((c) => !c)}
                  className="h-6 w-6 flex items-center justify-center text-foreground/80 hover:text-foreground rounded"
                  aria-label={doneCollapsed ? "Expand Done section" : "Collapse Done section"}
                >
                  <IconChevronDown
                    className={cn(
                      "h-6 w-6 transition-transform",
                      doneCollapsed && "-rotate-90"
                    )}
                  />
                </button>
                <h2 className="text-lg font-semibold">Done</h2>
                <span className="text-sm text-[#708597] ml-1">
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
                  {/* Same shared-width wrapper as the main list so the Done
                      rows' separators span the full horizontal scroll. */}
                  <div className="w-max min-w-full">
                    {sortedDoneTasks.map((task) => renderRow(task))}
                  </div>
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
        onSubmit={(_id, name) => {
          if (renamingSection) undoableRenameSection(renamingSection, name);
        }}
      />
      <DeleteSectionDialog
        section={deletingSection}
        open={!!deletingSection}
        onOpenChange={(open) => !open && setDeletingSection(null)}
        onConfirm={() => {
          if (deletingSection) undoableDeleteSection(deletingSection);
          setDeletingSection(null);
        }}
      />

      {/* Right-click context menu — only mounted while open so its
          document-level listeners don't run idle. */}
      {contextMenu && (
        <TaskContextMenu
          task={contextMenu.task}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
          onDuplicate={() => void duplicateTask(contextMenu.task)}
          onToggleStatus={() => toggleStatus(contextMenu.task)}
          onOpen={() => setSelectedTaskId(contextMenu.task.id)}
          onCopyLink={() => void copyTaskLink(contextMenu.task)}
          onDelete={() => setPendingDelete(contextMenu.task)}
        />
      )}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.title || "Untitled task"}” will be removed
              permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


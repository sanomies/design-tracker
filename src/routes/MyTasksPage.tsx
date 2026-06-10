import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  Check,
  GripVertical,
  Plus,
} from "lucide-react";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { IconChevronDown, IconSection } from "@/components/icons/figma";
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskContextMenu } from "@/features/tasks/TaskContextMenu";
import { useAuth } from "@/features/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import {
  AddSectionDialog,
  DeleteSectionDialog,
  RenameSectionDialog,
} from "@/features/sections/SectionDialogs";
import { SectionBlock } from "@/features/sections/SectionBlock";
import { SortableSection, sectionRowId } from "@/features/sections/SortableSection";
import { SortableTaskRow } from "@/features/tasks/SortableTaskRow";
import { TaskDetailPanel } from "@/features/tasks/TaskDetailPanel";
import { TaskListHeader } from "@/features/tasks/TaskListHeader";
import { TaskRow } from "@/features/tasks/TaskRow";
import { TaskSearchCombobox } from "@/features/tasks/TaskSearchCombobox";
import { recordTaskOpened } from "@/features/tasks/useRecentTasks";
import { defaultFilters, matchesFilters, type Filters } from "@/features/tasks/taskFilters";
import { type SortState } from "@/features/tasks/taskColumns";
import { buildSortComparator } from "@/features/tasks/taskSort";
import { useWorkspaceMembers } from "@/features/workspaces/useWorkspaceMembers";
import {
  useCreateMySection,
  useUndoableDeleteMySection,
  useUndoableRenameMySection,
  useReorderMySection,
  useMySections,
} from "@/features/tasks/useMySections";
import { MobileMyTasksList } from "@/features/tasks/MobileTaskList";
import { useMyTasks, useUpdateMyTask, type MyTaskRow } from "@/features/tasks/useMyTasks";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useResizableHeight } from "@/hooks/useResizableHeight";
import { useResizablePanel } from "@/hooks/useResizablePanel";
import { cn } from "@/lib/utils";
import type { MyTaskSection, Section, Task } from "@/types/database";

type DoneSort = "latest" | "oldest";
const DONE_SORT_STORAGE_KEY = "design-tracker:my-tasks:done-sort";
const COLLAPSED_STORAGE_KEY = "design-tracker:my-tasks:collapsed-sections";
const DONE_COLLAPSED_STORAGE_KEY = "design-tracker:my-tasks:done-collapsed";
const UNASSIGNED_COLLAPSED_KEY = "design-tracker:my-tasks:unassigned-collapsed";

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
  // Switch at the top level so the breakpoint flip mounts/unmounts entirely
  // separate trees — the desktop body below carries far more hooks (DnD,
  // resizable panes, context menu) than the mobile board, so swapping the
  // inner content conditionally would change the hook count mid-render.
  const isMobile = useIsMobile();
  return isMobile ? <MyTasksMobile /> : <MyTasksDesktop />;
}

function MyTasksDesktop() {
  const { data: tasks, isLoading: tasksLoading } = useMyTasks();
  const { data: sections = [], isLoading: sectionsLoading } = useMySections();
  const updateTask = useUpdateMyTask();
  const createSection = useCreateMySection();
  // Section rename + delete go through the undoable helpers (6s "Undo"
  // toast). See useMySections.ts for the rationale.
  const undoableRenameSection = useUndoableRenameMySection();
  const reorderSection = useReorderMySection();
  const undoableDeleteSection = useUndoableDeleteMySection();

  const isLoading = tasksLoading || sectionsLoading;

  // Top-level rows: a task assigned to me shows as its own row even if it's
  // technically a subtask of something else — its parent might not be mine.
  const allTasks = tasks ?? [];

  // Column filter + sort state. Shared with the project view via the same
  // TaskListHeader so both pages feel identical.
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sort, setSort] = useState<SortState>(null);

  // Tasks here can span multiple workspaces, so no single workspace member
  // list is "correct". We don't pass a workspace to the header — assignee
  // and createdBy member filters will be empty options as a result, but
  // publication / due / priority filters work the same as on the project
  // view, and the rest of the chrome stays consistent.
  const { data: members = [] } = useWorkspaceMembers(undefined);

  const { openTasks, doneTasks } = useMemo(() => {
    const open: MyTaskRow[] = [];
    const done: MyTaskRow[] = [];
    for (const t of allTasks) {
      if (!matchesFilters(t, filters)) continue;
      if (t.status === "done") done.push(t);
      else open.push(t);
    }
    return { openTasks: open, doneTasks: done };
  }, [allTasks, filters]);

  const sortedSections = useMemo(
    () => [...sections].sort((a, b) => a.position - b.position),
    [sections]
  );

  // Group open tasks by my_section_id. Null my_position → top (new arrivals
  // appear above already-placed ones in the same bucket). A column sort
  // overrides the manual my_position order within each group.
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
    const columnCmp = buildSortComparator(sort, members);
    const finalCmp = columnCmp ?? sortByMyPosition;
    us.sort(finalCmp);
    for (const arr of by.values()) arr.sort(finalCmp);
    return { unsectioned: us, bySection: by };
  }, [openTasks, sort, members]);

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

  // "Unassigned" pinned section — synthetic, lives above the user's
  // personal sections and can't be renamed or deleted. Collapse state is
  // persisted just like the real sections.
  const [unassignedCollapsed, setUnassignedCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(UNASSIGNED_COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(UNASSIGNED_COLLAPSED_KEY, String(unassignedCollapsed));
    } catch {
      // ignore
    }
  }, [unassignedCollapsed]);

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
  // Track opened tasks for the global search combobox's "Recents" list.
  useEffect(() => {
    if (selectedTaskId) recordTaskOpened(selectedTaskId);
  }, [selectedTaskId]);
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

  // Fullscreen mode for the detail panel — toggled from the panel header.
  // Reset whenever the panel closes so reopening starts in sidebar mode.
  const [panelFullscreen, setPanelFullscreen] = useState(false);
  useEffect(() => {
    if (!panelOpen) setPanelFullscreen(false);
  }, [panelOpen]);

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
          onContextMenu={handleRowContextMenu}
        />
      </SortableTaskRow>
    );
  };

  // ---- Right-click context menu ----
  // MyTasks lists tasks from many projects, so duplicate/delete go
  // straight through Supabase (project-scoped useCreateTask/useDeleteTask
  // hooks would need to be remade per-row, which can't be done
  // conditionally). Realtime + cache invalidation keeps the list fresh.
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [contextMenu, setContextMenu] = useState<
    | { task: Task; x: number; y: number }
    | null
  >(null);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);

  const handleRowContextMenu = (e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    setContextMenu({ task, x: e.clientX, y: e.clientY });
  };

  // Event-delegation listener at document level in capture phase — see
  // the same pattern in TaskList. The capture phase ensures it fires
  // before any descendant listener can interfere.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const rowEl = target?.closest<HTMLElement>("[data-task-id]");
      if (!rowEl) return;
      const taskId = rowEl.dataset.taskId;
      if (!taskId) return;
      const task = allTasks.find((t) => t.id === taskId);
      if (!task) return;
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ task, x: e.clientX, y: e.clientY });
    };
    document.addEventListener("contextmenu", handler, { capture: true });
    return () =>
      document.removeEventListener("contextmenu", handler, { capture: true });
  }, [allTasks]);

  const invalidateTaskCaches = (projectId: string | null | undefined) => {
    void queryClient.invalidateQueries({ queryKey: ["my-tasks", user?.id] });
    if (projectId) {
      void queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    }
  };

  const duplicateTask = async (task: Task) => {
    try {
      const { data: created, error: createErr } = await supabase
        .from("tasks")
        .insert({
          project_id: task.project_id,
          section_id: task.section_id,
          parent_task_id: task.parent_task_id,
          title: task.title,
          description: task.description,
          assignee_id: task.assignee_id,
          due_date: task.due_date,
          priority: task.priority,
          publication: task.publication,
          position: Date.now(),
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (createErr) throw createErr;
      invalidateTaskCaches(task.project_id);
      if (created?.id) setSelectedTaskId(created.id);
    } catch {
      toast.error("Failed to duplicate task");
    }
  };

  const toggleStatus = (task: Task) => {
    const next = task.status === "done" ? "todo" : "done";
    updateTask.mutate({ id: task.id, patch: { status: next } });
  };

  const copyTaskLink = async (task: Task) => {
    try {
      // Build a permalink to the task's project view with the task open,
      // not the current /my-tasks route — shared links land on the task
      // in its project context.
      const url = new URL(window.location.href);
      url.pathname = `/projects/${task.project_id}`;
      url.search = `?task=${task.id}`;
      await navigator.clipboard.writeText(url.toString());
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", target.id);
      if (error) throw error;
      invalidateTaskCaches(target.project_id);
      if (selectedTaskId === target.id) setSelectedTaskId(null);
      setPendingDelete(null);
    } catch {
      toast.error("Failed to delete task");
    }
  };

  const activeCount = openTasks.length;
  const empty =
    !isLoading && allTasks.length === 0 && sortedSections.length === 0;

  return (
    <div className="relative h-full flex">
      <section className="flex-1 min-w-0 flex flex-col">
        {/* Header + action row form one logical block in the Figma —
            16px outer padding with an 8px gap between rows (pb-0 + pt-2). */}
        <header className="px-4 pt-4 pb-0 flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 py-2">
            <h1 className="text-lg font-semibold leading-tight">My tasks</h1>
            {activeCount > 0 && (
              <span className="text-sm text-[#708597]">{activeCount}</span>
            )}
          </div>
          {/* flex-1 + justify-end lets the search grow into all
              remaining header width; the combobox itself caps at
              400px and stays right-aligned within. */}
          <div className="ml-auto flex-1 flex justify-end">
            <TaskSearchCombobox workspaceId={undefined} />
          </div>
        </header>

        {/* Action row — only Add Section here (My Tasks doesn't create
            tasks itself; tasks land via assignment from project views). */}
        <div className="shrink-0 bg-background px-4 pb-4 pt-2 flex items-center gap-2">
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
                {/* Header lives INSIDE the scroll container so header and
                    rows share the same width — when the scrollbar takes
                    width, both shrink together and column dividers stay
                    pixel-aligned. `sticky top-0` keeps it pinned. */}
                <div className="sticky top-0 z-20">
                  <TaskListHeader
                    workspaceId={undefined}
                    filters={filters}
                    onChange={setFilters}
                    sort={sort}
                    onSortChange={setSort}
                  />
                </div>
                {/* "Unassigned" — pinned at the top, always rendered. New
                    assignments land here; the user can drag them into
                    personal sections below. Can't be renamed or deleted. */}
                <SectionBlock
                  section={null}
                  tasks={unsectioned}
                  collapsed={unassignedCollapsed}
                  onToggleCollapsed={() => setUnassignedCollapsed((c) => !c)}
                  onRenameClick={() => undefined}
                  onDeleteClick={() => undefined}
                  onAddTask={() => undefined}
                  renderRow={renderRow}
                  hideAddTask
                  pinnedHeaderLabel="Unassigned"
                />

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
                // Redesigned Done section per Figma: flat gray block
                // (`#F6F9F9`) + single top border, full width. Chevron
                // bumps to 24×24 (larger than the 18×18 used on the inline
                // section headers above).
                className="shrink-0 flex flex-col bg-[#F6F9F9] border-t border-[#DEDFE0]"
                style={doneCollapsed ? undefined : { height: doneHeight }}
              >
                {!doneCollapsed && (
                  <button
                    type="button"
                    aria-label="Resize Done section"
                    onPointerDown={onDoneResize}
                    className="group h-1.5 w-full cursor-row-resize shrink-0 focus:outline-none bg-transparent"
                  >
                    <span
                      className={cn(
                        "block w-full h-0.5 transition-colors",
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
          onSubmit={(_id, name) => {
            if (renamingSection) undoableRenameSection(renamingSection, name);
          }}
        />
        <DeleteSectionDialog
          section={deletingSection ? toSectionShim(deletingSection) : null}
          open={!!deletingSection}
          onOpenChange={(open) => !open && setDeletingSection(null)}
          onConfirm={() => {
            if (deletingSection) undoableDeleteSection(deletingSection);
            setDeletingSection(null);
          }}
        />
      </section>

      <aside
        aria-hidden={!panelOpen || panelFullscreen}
        style={{ width: panelOpen && !panelFullscreen ? panelWidth : 0 }}
        className={cn(
          "relative shrink-0 overflow-hidden border-l bg-background",
          !isResizing && "transition-[width] duration-200 ease-out",
          panelOpen && !panelFullscreen && "shadow-[-12px_0_28px_-16px_rgba(0,0,0,0.18)]"
        )}
      >
        <div style={{ width: panelWidth }} className="h-full">
          {selectedTask && !panelFullscreen && (
            <TaskDetailPanel
              key={selectedTask.id}
              task={selectedTask}
              workspaceId={selectedTask.project?.workspace_id}
              onClose={closePanel}
              isFullscreen={false}
              onToggleFullscreen={() => setPanelFullscreen(true)}
            />
          )}
        </div>
      </aside>

      {panelOpen && !panelFullscreen && (
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

      {/* Fullscreen overlay — sits above everything (incl. the z-10
          sidebar) so the task panel takes the whole viewport. */}
      {selectedTask && panelFullscreen && (
        <div className="fixed inset-0 z-50 bg-background">
          <TaskDetailPanel
            key={`${selectedTask.id}-fs`}
            task={selectedTask}
            workspaceId={selectedTask.project?.workspace_id}
            onClose={closePanel}
            isFullscreen
            onToggleFullscreen={() => setPanelFullscreen(false)}
          />
        </div>
      )}

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

/**
 * Mobile My Tasks — reuses the shared mobile board (pinned Name column +
 * horizontal-scroll metadata) driven by the my-task sections data, and
 * renders the task detail panel as a full-screen overlay that stops just
 * above the bottom tab bar (matching the project view's mobile behavior).
 */
function MyTasksMobile() {
  const { data: tasks } = useMyTasks();
  const allTasks = tasks ?? [];

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTaskId = searchParams.get("task");
  const selectedTask = allTasks.find((t) => t.id === selectedTaskId) ?? null;

  useEffect(() => {
    if (selectedTaskId) recordTaskOpened(selectedTaskId);
  }, [selectedTaskId]);

  const closePanel = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("task");
    setSearchParams(next, { replace: true });
  };

  // Esc closes the panel unless a dialog/menu is open first.
  useEffect(() => {
    if (!selectedTask) return;
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
  }, [selectedTask, searchParams]);

  return (
    <div className="relative h-full">
      <MobileMyTasksList />

      {selectedTask && (
        // Stops above the 56px bottom tab bar (+ safe area) so the nav stays
        // reachable while a task is open — same as the project view.
        <div className="fixed inset-x-0 top-0 z-50 bg-background bottom-[calc(3.5rem+env(safe-area-inset-bottom))]">
          <TaskDetailPanel
            key={`${selectedTask.id}-fs`}
            task={selectedTask}
            workspaceId={selectedTask.project?.workspace_id}
            onClose={closePanel}
            isFullscreen
          />
        </div>
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

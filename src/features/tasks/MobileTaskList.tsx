import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format, isToday, isTomorrow, isYesterday, parseISO } from "date-fns";

import {
  IconChevronDown,
  IconCirclePlus,
  IconSection,
} from "@/components/icons/figma";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AddSectionDialog,
  RenameSectionDialog,
  DeleteSectionDialog,
} from "@/features/sections/SectionDialogs";
import {
  useCreateSection,
  useSections,
  useUndoableDeleteSection,
  useUndoableRenameSection,
} from "@/features/sections/useSections";
import { useWorkspaceMembers } from "@/features/workspaces/useWorkspaceMembers";
import { avatarColor } from "@/lib/avatarColor";
import { cn } from "@/lib/utils";
import type { Section, Task } from "@/types/database";

import { TaskCheckbox } from "./TaskCheckbox";
import { getPublication } from "./publications";
import { getTaskType } from "./taskTypes";
import {
  useCreateTask,
  useTasks,
  useUpdateTask,
  useUndoableRenameTask,
} from "./useTasks";

// Mobile column widths — chosen so the metadata strip totals ~480px,
// scrollable to the right of the pinned 200px Name column. Tweaking
// these is the cheapest way to tune the layout's density.
const COL_PUBLICATION = 130;
const COL_ASSIGNEE = 140;
const COL_DUE = 100;
const COL_TYPE = 110;
const NAME_MIN = 200;

const COLLAPSED_STORAGE_PREFIX = "design-tracker:collapsed-sections:";
const DONE_COLLAPSED_STORAGE_PREFIX = "design-tracker:done-collapsed:";

/**
 * Mobile task list. Pins the Name column with `position: sticky; left:0`
 * inside a horizontal-scroll container so the title never moves while
 * the user pans the Publication / Assignee / Due Date columns to its
 * right. Drag-to-reorder is intentionally omitted: on touch it fought
 * with the scroll and made rows "swim" under the finger.
 */
export function MobileTaskList({
  projectId,
  workspaceId,
}: {
  projectId: string;
  workspaceId: string | undefined;
}) {
  const { data: tasks, isLoading } = useTasks(projectId);
  const { data: sections = [] } = useSections(projectId);
  const createTask = useCreateTask(projectId);
  const createSection = useCreateSection(projectId);
  const undoableRenameSection = useUndoableRenameSection(projectId);
  const undoableDeleteSection = useUndoableDeleteSection(projectId);

  const { topLevel } = useMemo(() => {
    const top: Task[] = [];
    for (const t of tasks ?? []) {
      if (!t.parent_task_id) top.push(t);
    }
    return { topLevel: top };
  }, [tasks]);

  const { openTasks, doneTasks } = useMemo(() => {
    const open: Task[] = [];
    const done: Task[] = [];
    for (const t of topLevel) {
      if (t.status === "done") done.push(t);
      else open.push(t);
    }
    return { openTasks: open, doneTasks: done };
  }, [topLevel]);

  const sortedSections = useMemo(
    () => [...sections].sort((a, b) => a.position - b.position),
    [sections]
  );

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
    const byPos = (a: Task, b: Task) => a.position - b.position;
    us.sort(byPos);
    for (const arr of by.values()) arr.sort(byPos);
    return { unsectioned: us, bySection: by };
  }, [openTasks]);

  const sortedDoneTasks = useMemo(
    () =>
      [...doneTasks].sort((a, b) => {
        const aT = a.completed_at ?? a.created_at;
        const bT = b.completed_at ?? b.created_at;
        return bT.localeCompare(aT);
      }),
    [doneTasks]
  );

  // Section + Done collapse state, persisted per project — keys mirror the
  // desktop list so toggling on one device shows up on the other.
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

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTaskId = searchParams.get("task");

  const setSelectedTaskId = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("task", id);
    else next.delete("task");
    setSearchParams(next, { replace: true });
  };

  const handleAddTask = async () => {
    const unassigned = sortedSections.find(
      (s) => s.name.trim().toLowerCase() === "unassigned"
    );
    const targetSectionId = unassigned?.id ?? sortedSections[0]?.id ?? null;
    try {
      const task = await createTask.mutateAsync({ title: "", sectionId: targetSectionId });
      setSelectedTaskId(task.id);
    } catch {
      // toast already fired by the mutation
    }
  };

  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [renamingSection, setRenamingSection] = useState<Section | null>(null);
  const [deletingSection, setDeletingSection] = useState<Section | null>(null);

  // Scroll width covers the sticky Name column + all metadata cells. We
  // set this as the inner content width so the horizontal scroll has a
  // single, stable extent regardless of how many sections are rendered.
  const innerWidth = `calc(${NAME_MIN}px + ${COL_PUBLICATION + COL_ASSIGNEE + COL_TYPE + COL_DUE}px)`;

  return (
    <div className="h-full flex flex-col">
      {/* Same Add task / Add Section pills as desktop. */}
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
        <div className="flex-1 min-h-0 px-3 py-2 space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-3/4" />
        </div>
      ) : topLevel.length === 0 && sections.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center px-6 py-16 text-center text-sm text-muted-foreground">
          No tasks yet. Tap <span className="font-semibold">Add task</span> to create one.
        </div>
      ) : (
        // Single scroll container — owns BOTH axes. Vertical scroll moves
        // sections + rows up/down; horizontal scroll moves only the
        // metadata cells (Name stays pinned via `position: sticky`).
        <div className="flex-1 min-h-0 overflow-auto">
          <div style={{ width: innerWidth }} className="min-w-full">
            {/* Sticky column header. Top-0 keeps it pinned vertically;
                its Name cell is also sticky-left so the "Name" label
                stays visible while the metadata cells pan. */}
            <div className="sticky top-0 z-30 flex bg-white text-xs font-medium text-[#708597] shadow-[0_2px_2px_rgba(0,0,0,0.06)]">
              <HeaderCell sticky width={NAME_MIN}>
                Name
              </HeaderCell>
              <HeaderCell width={COL_PUBLICATION}>Publication</HeaderCell>
              <HeaderCell width={COL_ASSIGNEE}>Assignee</HeaderCell>
              <HeaderCell width={COL_TYPE}>Type</HeaderCell>
              <HeaderCell width={COL_DUE}>Due Date</HeaderCell>
            </div>

            {unsectioned.length > 0 && (
              <MobileSection
                section={null}
                tasks={unsectioned}
                collapsed={false}
                onToggleCollapsed={() => undefined}
                onRenameClick={() => undefined}
                onDeleteClick={() => undefined}
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
                workspaceId={workspaceId}
              />
            )}

            {sortedSections.map((section) => (
              <MobileSection
                key={section.id}
                section={section}
                tasks={bySection.get(section.id) ?? []}
                collapsed={collapsedSet.has(section.id)}
                onToggleCollapsed={() => toggleCollapsed(section.id)}
                onRenameClick={() => setRenamingSection(section)}
                onDeleteClick={() => setDeletingSection(section)}
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
                workspaceId={workspaceId}
              />
            ))}

            {doneTasks.length > 0 && (
              <DoneSection
                tasks={sortedDoneTasks}
                collapsed={doneCollapsed}
                onToggleCollapsed={() => setDoneCollapsed((c) => !c)}
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
                workspaceId={workspaceId}
              />
            )}
          </div>
        </div>
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
    </div>
  );
}

function HeaderCell({
  width,
  sticky = false,
  children,
}: {
  width: number;
  sticky?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{ width, minWidth: width }}
      className={cn(
        "shrink-0 px-3 py-2.5 flex items-center bg-white",
        // The Name cell also pins horizontally; raise its z-index above
        // the rest of the header row so the column dividers don't show
        // through during a horizontal scroll.
        sticky && "sticky left-0 z-10"
      )}
    >
      <span className="truncate">{children}</span>
    </div>
  );
}

function MobileSection({
  section,
  tasks,
  collapsed,
  onToggleCollapsed,
  onRenameClick,
  onDeleteClick,
  selectedTaskId,
  onSelectTask,
  workspaceId,
}: {
  section: Section | null;
  tasks: Task[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onRenameClick: () => void;
  onDeleteClick: () => void;
  selectedTaskId: string | null;
  onSelectTask: (id: string | null) => void;
  workspaceId: string | undefined;
}) {
  const hasHeader = !!section;
  return (
    <div className={cn(hasHeader && "pt-4 pb-1")}>
      {hasHeader && (
        // Sticky-left so the section title stays visible while the
        // metadata cells scroll horizontally. Long-press opens the
        // rename/delete menu.
        <div className="sticky left-0 z-10 flex items-center gap-2 px-4 py-1.5 bg-background">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="h-[18px] w-[18px] flex items-center justify-center text-foreground/80 rounded"
            aria-label={collapsed ? "Expand section" : "Collapse section"}
          >
            <IconChevronDown
              className={cn(
                "h-[18px] w-[18px] transition-transform",
                collapsed && "-rotate-90"
              )}
            />
          </button>
          <button
            type="button"
            onClick={onRenameClick}
            onContextMenu={(e) => {
              e.preventDefault();
              onDeleteClick();
            }}
            className="text-lg font-semibold truncate text-left"
            title={section!.name}
          >
            {section!.name}
          </button>
          <span className="text-sm text-[#708597] ml-1">{tasks.length}</span>
        </div>
      )}

      {(!hasHeader || !collapsed) && (
        <ul className="flex flex-col">
          {tasks.map((task) => (
            <MobileTaskRow
              key={task.id}
              task={task}
              workspaceId={workspaceId}
              selected={task.id === selectedTaskId}
              onSelect={() =>
                onSelectTask(task.id === selectedTaskId ? null : task.id)
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function DoneSection({
  tasks,
  collapsed,
  onToggleCollapsed,
  selectedTaskId,
  onSelectTask,
  workspaceId,
}: {
  tasks: Task[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  selectedTaskId: string | null;
  onSelectTask: (id: string | null) => void;
  workspaceId: string | undefined;
}) {
  return (
    <div className="mt-6 bg-[#F6F9F9] border-t border-[#DEDFE0]">
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="sticky left-0 z-10 w-auto flex items-center gap-2 px-4 py-2 text-left bg-[#F6F9F9]"
        aria-label={collapsed ? "Expand Done section" : "Collapse Done section"}
      >
        <IconChevronDown
          className={cn(
            "h-6 w-6 text-foreground/80 transition-transform",
            collapsed && "-rotate-90"
          )}
        />
        <h2 className="text-lg font-semibold">Done</h2>
        <span className="text-sm text-[#708597] ml-1">{tasks.length}</span>
      </button>
      {!collapsed && (
        <ul className="flex flex-col">
          {tasks.map((task) => (
            <MobileTaskRow
              key={task.id}
              task={task}
              workspaceId={workspaceId}
              selected={task.id === selectedTaskId}
              onSelect={() =>
                onSelectTask(task.id === selectedTaskId ? null : task.id)
              }
              tinted
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function MobileTaskRow({
  task,
  workspaceId,
  selected,
  onSelect,
  tinted = false,
}: {
  task: Task;
  workspaceId: string | undefined;
  selected: boolean;
  onSelect: () => void;
  /** Apply the Done-section's gray tint to the row + sticky Name cell. */
  tinted?: boolean;
}) {
  const updateTask = useUpdateTask(task.project_id);
  const undoableRenameTask = useUndoableRenameTask(task.project_id);
  const { data: members } = useWorkspaceMembers(workspaceId);
  const assignee = members?.find((m) => m.id === task.assignee_id);
  const publication = getPublication(task.publication);
  const taskType = getTaskType(task.type);
  const due = task.due_date ? formatDueDate(task.due_date) : null;
  const done = task.status === "done";

  const toggleDone = () => {
    updateTask.mutate({
      id: task.id,
      patch: { status: done ? "todo" : "done" },
    });
  };

  // The sticky Name cell needs a bg that exactly matches the row so the
  // metadata cells don't "show through" during horizontal scroll. We
  // pre-resolve it once and apply it to both the row and the Name cell.
  const rowBg = selected
    ? "bg-[#F6F9F9]"
    : tinted
      ? "bg-[#F6F9F9]"
      : "bg-white";

  return (
    <li
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group relative flex items-stretch border-t border-[#DEDFE0] min-h-[44px]",
        rowBg
      )}
    >
      <div
        style={{ width: NAME_MIN, minWidth: NAME_MIN }}
        className={cn(
          "sticky left-0 z-10 shrink-0 flex items-center gap-2 px-3 py-2",
          rowBg
        )}
      >
        <TaskCheckbox
          checked={done}
          onCheckedChange={toggleDone}
          onClick={(e) => e.stopPropagation()}
          aria-label={done ? "Mark incomplete" : "Mark complete"}
          className="h-[18px] w-[18px] shrink-0"
        />
        <InlineTitle
          title={task.title}
          done={done}
          onSave={(t) => undoableRenameTask(task, t)}
        />
      </div>

      <div
        style={{ width: COL_PUBLICATION, minWidth: COL_PUBLICATION }}
        className="shrink-0 px-3 py-2 flex items-center gap-2"
      >
        {publication ? (
          <>
            <img
              src={publication.thumbnail}
              alt=""
              className="h-6 w-6 rounded object-cover shrink-0"
            />
            <span className="text-xs truncate">{publication.name}</span>
          </>
        ) : (
          <Empty />
        )}
      </div>

      <div
        style={{ width: COL_ASSIGNEE, minWidth: COL_ASSIGNEE }}
        className="shrink-0 px-3 py-2 flex items-center gap-2"
      >
        {assignee ? (
          <>
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarFallback
                className={cn("text-[10px]", avatarColor(assignee.id))}
              >
                {initials(assignee.full_name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs truncate">
              {assignee.full_name ?? "Unnamed"}
            </span>
          </>
        ) : (
          <Empty />
        )}
      </div>

      <div
        style={{ width: COL_TYPE, minWidth: COL_TYPE }}
        className="shrink-0 px-3 py-2 flex items-center"
      >
        {taskType ? (
          <span className="text-xs truncate">{taskType.name}</span>
        ) : (
          <Empty />
        )}
      </div>

      <div
        style={{ width: COL_DUE, minWidth: COL_DUE }}
        className="shrink-0 px-3 py-2 flex items-center"
      >
        {due ? (
          <span
            className={cn(
              "text-xs",
              due.tone === "past" && "text-destructive",
              due.tone === "today" && "text-amber-600 font-medium",
              due.tone === "soon" && "text-foreground",
              due.tone === "later" && "text-muted-foreground"
            )}
          >
            {due.label}
          </span>
        ) : (
          <Empty />
        )}
      </div>
    </li>
  );
}

function Empty() {
  return <span className="text-muted-foreground/30 text-xs">—</span>;
}

function InlineTitle({
  title,
  done,
  onSave,
}: {
  title: string;
  done: boolean;
  onSave: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);

  useEffect(() => {
    if (!editing) setValue(title);
  }, [title, editing]);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== title) onSave(trimmed);
    else setValue(title);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setValue(title);
            setEditing(false);
          }
        }}
        className={cn(
          "flex-1 min-w-0 bg-white text-sm rounded border border-[#DEDFE0] outline-none focus:ring-2 focus:ring-foreground/10 px-1.5 py-0.5 -mx-1.5 -my-0.5",
          done && "line-through text-[#708597]"
        )}
      />
    );
  }

  return (
    <span
      // Double-tap to edit on mobile — single tap opens the detail
      // panel via the row click. onDoubleClick still fires on touch in
      // modern mobile browsers when two taps land in quick succession.
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      className={cn(
        "flex-1 min-w-0 text-sm truncate",
        done && "line-through text-[#708597]",
        !title && "text-[#708597] italic"
      )}
    >
      {title || "Untitled task"}
    </span>
  );
}

function formatDueDate(due: string): {
  label: string;
  tone: "past" | "today" | "soon" | "later";
} {
  const date = parseISO(due);
  if (isToday(date)) return { label: "Today", tone: "today" };
  if (isYesterday(date)) return { label: "Yesterday", tone: "past" };
  if (isTomorrow(date)) return { label: "Tomorrow", tone: "soon" };
  if (date.getTime() < Date.now()) {
    return { label: format(date, "MMM d"), tone: "past" };
  }
  return { label: format(date, "MMM d"), tone: "later" };
}

function initials(name: string | null | undefined, fallback = "?"): string {
  if (!name) return fallback;
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

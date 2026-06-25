import { useEffect, useRef, useState } from "react";
import { format, isToday, isTomorrow, isYesterday, parseISO } from "date-fns";
import { ListChecks } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { TaskCheckbox } from "./TaskCheckbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkspaceMembers } from "@/features/workspaces/useWorkspaceMembers";
import { avatarColor } from "@/lib/avatarColor";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/database";

import { AssigneePickerContent } from "./AssigneePicker";
import { DueDatePickerContent } from "./DueDatePicker";
import { priorityMeta } from "./priority";
import { PriorityPickerContent } from "./PriorityPicker";
import { PublicationPickerContent } from "./PublicationPicker";
import { catalogItem, catalogType } from "./catalog";
import { useCatalog } from "./CatalogProvider";
import { BrandThumb } from "./BrandThumb";
import { TypePickerContent } from "./TypePicker";
import {
  effectiveColumnWidth,
  useColumnOrder,
  useHiddenColumns,
  useColumnWidths,
  useNameWidth,
  type ColumnId,
} from "./taskColumns";
import { useUndoableRenameTask, useUpdateTask } from "./useTasks";

function initials(name: string | null | undefined, fallback = "?"): string {
  if (!name) return fallback;
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDueDate(due: string): { label: string; tone: "past" | "today" | "soon" | "later" } {
  const date = parseISO(due);
  if (isToday(date)) return { label: "Today", tone: "today" };
  if (isYesterday(date)) return { label: "Yesterday", tone: "past" };
  if (isTomorrow(date)) return { label: "Tomorrow", tone: "soon" };
  if (date.getTime() < Date.now()) {
    return { label: format(date, "MMM d"), tone: "past" };
  }
  return { label: format(date, "MMM d"), tone: "later" };
}

export function TaskRow({
  task,
  workspaceId,
  selected,
  onSelect,
  onContextMenu,
  subtaskTotal = 0,
  subtaskDone = 0,
}: {
  task: Task;
  workspaceId: string | undefined;
  selected: boolean;
  onSelect: () => void;
  /** Forwarded to the row's `onContextMenu` so the parent can open a
   *  right-click menu anchored at the cursor. The row itself doesn't
   *  decide whether to suppress the native menu — that's the parent's
   *  call (lets the parent skip the menu in drag-overlay previews, etc.). */
  onContextMenu?: (e: React.MouseEvent, task: Task) => void;
  subtaskTotal?: number;
  subtaskDone?: number;
}) {
  const updateTask = useUpdateTask(task.project_id);
  // Inline title edits go through the undoable rename helper so the
  // user can revert with a single click after committing a rename.
  const undoableRenameTask = useUndoableRenameTask(task.project_id);
  const { data: members } = useWorkspaceMembers(workspaceId);
  const assignee = members?.find((m) => m.id === task.assignee_id);
  const creator = members?.find((m) => m.id === task.created_by);
  const priority = priorityMeta(task.priority);
  const due = task.due_date ? formatDueDate(task.due_date) : null;
  const catalog = useCatalog();
  const publication = catalogItem(catalog, task.publication);
  const taskType = catalogType(catalog, task.type);
  const done = task.status === "done";
  const order = useColumnOrder();
  const hidden = useHiddenColumns();
  // Honour the user's per-column visibility toggle from the header
  // settings dropdown. Filtering here keeps the rendered row in lockstep
  // with the header (same set, same order) for free.
  const visibleOrder = order.filter((id) => !hidden.has(id));
  const widths = useColumnWidths();
  const nameWidth = useNameWidth();

  // When the user marks an open task as done from the list view, we
  // hold the row in place for a short beat (so the green check is
  // visible) and then fade it out before firing the actual status
  // mutation — which is what relocates it to the Done section. Going
  // the other direction (undoing a completion) skips the animation,
  // since waiting feels weird for an undo.
  const [pendingDone, setPendingDone] = useState(false);
  const pendingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current !== null) {
        clearTimeout(pendingTimerRef.current);
      }
    };
  }, []);

  const toggleDone = () => {
    if (done) {
      updateTask.mutate({ id: task.id, patch: { status: "todo" } });
      return;
    }
    // Already mid-animation — ignore re-clicks so the timer isn't
    // duplicated and so toasts don't stack.
    if (pendingDone) return;

    const previousStatus = task.status;
    setPendingDone(true);
    pendingTimerRef.current = window.setTimeout(() => {
      updateTask.mutate({ id: task.id, patch: { status: "done" } });
      toast.success(`Completed “${task.title}”`, {
        duration: 6000,
        action: {
          label: "Undo",
          onClick: () =>
            updateTask.mutate({ id: task.id, patch: { status: previousStatus } }),
        },
      });
      pendingTimerRef.current = null;
      // No need to setPendingDone(false): the upcoming re-render with
      // task.status === "done" relocates this row to the Done section,
      // where the checkbox is naturally checked already.
    }, 600);
  };

  // Inline pickers. Popover open state is local so clicking the cell opens
  // the menu without bubbling up to the row's `onSelect` (which would
  // open the task detail panel).
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [dueOpen, setDueOpen] = useState(false);
  const [publicationOpen, setPublicationOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);

  const stopRowClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
  };

  // Stop pointer propagation so a click on an inline picker / checkbox
  // / inline-title input never arms the row's dnd-kit drag activator.
  // Mirrors how the sidebar's ProjectRow stops its More button from
  // triggering a row drag.
  const stopRowPointer = (e: React.PointerEvent) => {
    e.stopPropagation();
  };

  // Cell content keyed by column id. Wrapped in a fixed-width, padded
  // container by the strip below so dividers (via `divide-x`) line up.
  const renderCell = (id: ColumnId) => {
    switch (id) {
      case "publication":
        return (
          <Popover open={publicationOpen} onOpenChange={setPublicationOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onPointerDown={stopRowPointer}
                onClick={stopRowClick}
                onKeyDown={stopRowClick}
                className="w-full flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-accent text-left transition-colors"
                aria-label={
                  publication
                    ? `Change ${catalog.itemLabel.toLowerCase()} (${publication.name})`
                    : `Set ${catalog.itemLabel.toLowerCase()}`
                }
                title={publication?.name}
              >
                {publication ? (
                  <>
                    <BrandThumb thumbnail={publication.thumbnail} className="h-6 w-6 rounded" />
                    <span className="text-xs truncate">{publication.name}</span>
                  </>
                ) : (
                  <EmptyCell />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="p-1 w-64 max-h-80 overflow-y-auto"
              onClick={stopRowClick}
            >
              <PublicationPickerContent
                value={task.publication}
                onChange={(publication) =>
                  updateTask.mutate({ id: task.id, patch: { publication } })
                }
                onClose={() => setPublicationOpen(false)}
              />
            </PopoverContent>
          </Popover>
        );

      case "assignee":
        return (
          <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onPointerDown={stopRowPointer}
                onClick={stopRowClick}
                onKeyDown={stopRowClick}
                className="w-full flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-accent text-left transition-colors"
                aria-label={
                  assignee
                    ? `Change assignee (${assignee.full_name ?? "Unnamed"})`
                    : "Set assignee"
                }
                title={assignee?.full_name ?? undefined}
              >
                {assignee ? (
                  <>
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarFallback className={cn("text-[10px]", avatarColor(assignee.id))}>
                        {initials(assignee.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs truncate">
                      {assignee.full_name ?? "Unnamed"}
                    </span>
                  </>
                ) : (
                  <EmptyCell />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="p-1 w-56"
              onClick={stopRowClick}
            >
              <AssigneePickerContent
                members={members ?? []}
                value={task.assignee_id}
                onChange={(assignee_id) =>
                  updateTask.mutate({ id: task.id, patch: { assignee_id } })
                }
                onClose={() => setAssigneeOpen(false)}
              />
            </PopoverContent>
          </Popover>
        );

      case "due":
        return (
          <Popover open={dueOpen} onOpenChange={setDueOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onPointerDown={stopRowPointer}
                onClick={stopRowClick}
                onKeyDown={stopRowClick}
                className="w-full flex items-center text-xs whitespace-nowrap rounded px-1 py-0.5 hover:bg-accent text-left transition-colors"
                aria-label={due ? `Change due date (${due.label})` : "Set due date"}
              >
                {due ? (
                  <span
                    className={cn(
                      due.tone === "past" && "text-destructive",
                      due.tone === "today" && "text-amber-600 font-medium",
                      due.tone === "soon" && "text-foreground",
                      due.tone === "later" && "text-muted-foreground"
                    )}
                  >
                    {due.label}
                  </span>
                ) : (
                  <EmptyCell />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="p-0 w-auto"
              onClick={stopRowClick}
            >
              <DueDatePickerContent
                value={task.due_date}
                onChange={(due_date) =>
                  updateTask.mutate({ id: task.id, patch: { due_date } })
                }
                onClose={() => setDueOpen(false)}
              />
            </PopoverContent>
          </Popover>
        );

      case "createdBy":
        return creator ? (
          <div className="w-full flex items-center px-1">
            <span
              className="text-xs truncate"
              title={creator.full_name ?? undefined}
            >
              {creator.full_name ?? "Unnamed"}
            </span>
          </div>
        ) : (
          <div className="px-1">
            <EmptyCell />
          </div>
        );

      case "priority":
        return (
          <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onPointerDown={stopRowPointer}
                onClick={stopRowClick}
                onKeyDown={stopRowClick}
                className="w-full flex items-center rounded px-1 py-0.5 hover:bg-accent text-left transition-colors"
                aria-label={
                  priority ? `Change priority (${priority.label})` : "Set priority"
                }
                title={priority?.label}
              >
                {priority ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-[18px] px-2 rounded-full text-[10px] font-semibold uppercase",
                      priority.className
                    )}
                  >
                    {priority.label}
                  </Badge>
                ) : (
                  <EmptyCell />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="p-1 w-44"
              onClick={stopRowClick}
            >
              <PriorityPickerContent
                value={task.priority}
                onChange={(priority) =>
                  updateTask.mutate({ id: task.id, patch: { priority } })
                }
                onClose={() => setPriorityOpen(false)}
              />
            </PopoverContent>
          </Popover>
        );

      case "type":
        return (
          <Popover open={typeOpen} onOpenChange={setTypeOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onPointerDown={stopRowPointer}
                onClick={stopRowClick}
                onKeyDown={stopRowClick}
                className="w-full flex items-center rounded px-1 py-0.5 hover:bg-accent text-left transition-colors"
                aria-label={taskType ? `Change type (${taskType.name})` : "Set type"}
                title={taskType?.name}
              >
                {taskType ? (
                  <span className="text-xs truncate">{taskType.name}</span>
                ) : (
                  <EmptyCell />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="p-1 w-44" onClick={stopRowClick}>
              <TypePickerContent
                value={task.type}
                onChange={(type) => updateTask.mutate({ id: task.id, patch: { type } })}
                onClose={() => setTypeOpen(false)}
              />
            </PopoverContent>
          </Popover>
        );
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      // `data-task-id` is the hook used by the scroll-container's global
      // contextmenu listener to identify which row was right-clicked.
      // Cheaper than threading a handler down through SortableTaskRow's
      // dnd-kit-controlled <li>, and immune to any React/dnd-kit synthetic
      // event interception on the wrapper.
      data-task-id={task.id}
      onClick={onSelect}
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, task) : undefined}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        // Figma spec: rows are a fixed 38px tall (10px vertical padding
        // around 18px content). Locking the height directly — instead
        // of relying on py + intrinsic child sizes — keeps rows uniform
        // even when individual cells contain something taller than 18px.
        "group relative flex items-stretch gap-2 pl-4 pr-4 h-[38px] cursor-pointer transition-[opacity,transform,background-color] duration-300",
        "before:pointer-events-none before:absolute before:left-4 before:right-4 before:top-0 before:h-px before:bg-[#DEDFE0]",
        selected ? "bg-[#F6F9F9]" : "hover:bg-[#F6F9F9]/60",
        // While pending-done: 300ms of "green check is visible, row
        // still here" then 300ms of fade + slide-up before the mutation
        // moves the row to the Done section.
        pendingDone && "opacity-0 -translate-y-1 delay-300"
      )}
    >
      {/* 18×18 circle, sitting directly at the row's left padding edge so
          its left side aligns pixel-perfect with the 18px section chevron
          in the header above (both at 16px from the panel edge). */}
      <TaskCheckbox
        checked={done || pendingDone}
        onCheckedChange={toggleDone}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={done ? "Mark incomplete" : "Mark complete"}
        className="self-center h-[18px] w-[18px]"
      />

      {/* Name cell: title + subtask count badge. Fixed width (set by
          the header's Name resize handle) so the columns block lines
          up across all rows and has a stable left edge. */}
      <div
        style={{ width: nameWidth }}
        className="shrink-0 min-w-0 flex items-center gap-2"
      >
        <InlineTitleEdit
          task={task}
          done={done}
          onSave={(title) => undoableRenameTask(task, title)}
        />
        {subtaskTotal > 0 && (
          <span
            className="inline-flex items-center gap-1 text-xs text-[#708597] shrink-0"
            title={`${subtaskDone} of ${subtaskTotal} subtasks complete`}
          >
            <ListChecks className="h-3.5 w-3.5" />
            {subtaskDone}/{subtaskTotal}
          </span>
        )}
      </div>

      {/* Metadata strip. Clean — no vertical dividers between cells (the
          row's own top-border is the only horizontal line). */}
      <div className="shrink-0 flex items-stretch">
        {visibleOrder.map((id) => (
          <div
            key={id}
            style={{ width: effectiveColumnWidth(id, widths) }}
            className="shrink-0 px-2 flex items-center"
          >
            {renderCell(id)}
          </div>
        ))}
      </div>
    </div>
  );
}

// Subtle em-dash for empty cells — keeps columns visually aligned without
// blank gaps that look like missing data.
function EmptyCell() {
  return <span className="text-muted-foreground/30 text-xs">—</span>;
}

/**
 * Inline editor for the task title rendered in the list. Hover surfaces a
 * subtle bg + text caret so it's obviously editable; a single click swaps
 * the label for an `<input>` that saves on blur or Enter and reverts on
 * Escape. All pointer/keyboard events are stopped so the surrounding
 * row's `onClick` (which opens the detail panel) and the dnd-kit drag
 * activator don't fire while the title is being edited.
 */
function InlineTitleEdit({
  task,
  done,
  onSave,
}: {
  task: Task;
  done: boolean;
  onSave: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.title);

  // Keep the local draft in sync with the task title whenever we're not
  // actively editing (so realtime updates or other clients' edits show up).
  useEffect(() => {
    if (!editing) setValue(task.title);
  }, [task.title, editing]);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== task.title) {
      onSave(trimmed);
    } else {
      // Either empty input or unchanged — drop the draft and revert to
      // whatever the server has.
      setValue(task.title);
    }
    setEditing(false);
  };

  const cancel = () => {
    setValue(task.title);
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
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        className={cn(
          "flex-1 min-w-0 bg-white text-sm rounded border border-[#DEDFE0] outline-none focus:ring-2 focus:ring-foreground/10",
          // -mx/-my pull the input flush against where the text was so
          // there's no layout shift when entering/leaving edit mode.
          "px-1.5 py-0.5 -mx-1.5 -my-0.5",
          done && "line-through text-[#708597]"
        )}
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={-1}
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      className={cn(
        "text-sm truncate cursor-text rounded px-1 -mx-1 hover:bg-[#EDF2F4] transition-colors",
        done && "line-through text-[#708597]",
        !task.title && "text-[#708597] italic"
      )}
    >
      {task.title || "Untitled task"}
    </span>
  );
}

import { useState } from "react";
import { format, isToday, isTomorrow, isYesterday, parseISO } from "date-fns";
import { ListChecks } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkspaceMembers } from "@/features/workspaces/useWorkspaceMembers";
import { avatarColor } from "@/lib/avatarColor";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/database";

import { AssigneePickerContent } from "./AssigneePicker";
import { DueDatePickerContent } from "./DueDatePicker";
import { priorityMeta } from "./priority";
import { COLUMN_WIDTHS } from "./taskFilters";
import { useUpdateTask } from "./useTasks";

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
  subtaskTotal = 0,
  subtaskDone = 0,
}: {
  task: Task;
  workspaceId: string | undefined;
  selected: boolean;
  onSelect: () => void;
  subtaskTotal?: number;
  subtaskDone?: number;
}) {
  const updateTask = useUpdateTask(task.project_id);
  const { data: members } = useWorkspaceMembers(workspaceId);
  const assignee = members?.find((m) => m.id === task.assignee_id);
  const creator = members?.find((m) => m.id === task.created_by);
  const priority = priorityMeta(task.priority);
  const due = task.due_date ? formatDueDate(task.due_date) : null;
  const done = task.status === "done";

  const toggleDone = () => {
    if (done) {
      updateTask.mutate({ id: task.id, patch: { status: "todo" } });
      return;
    }
    const previousStatus = task.status;
    updateTask.mutate({ id: task.id, patch: { status: "done" } });
    toast.success(`Completed “${task.title}”`, {
      duration: 6000,
      action: {
        label: "Undo",
        onClick: () =>
          updateTask.mutate({ id: task.id, patch: { status: previousStatus } }),
      },
    });
  };

  // Inline pickers. Popover open state is local so clicking the cell opens
  // the menu without bubbling up to the row's `onSelect` (which would
  // open the task detail panel).
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [dueOpen, setDueOpen] = useState(false);

  const stopRowClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
  };

  return (
    <div
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
        "group flex items-center gap-3 px-3 py-2 border-b cursor-pointer transition-colors",
        selected ? "bg-accent" : "hover:bg-muted/50"
      )}
    >
      <Checkbox
        checked={done}
        onCheckedChange={toggleDone}
        onClick={(e) => e.stopPropagation()}
        aria-label={done ? "Mark incomplete" : "Mark complete"}
        className="border-muted-foreground/40 hover:border-emerald-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 data-[state=checked]:text-white transition-colors"
      />

      {/* Name cell: title + subtask count badge */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span
          className={cn(
            "text-sm truncate",
            done && "line-through text-muted-foreground"
          )}
        >
          {task.title}
        </span>
        {subtaskTotal > 0 && (
          <span
            className="inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0"
            title={`${subtaskDone} of ${subtaskTotal} subtasks complete`}
          >
            <ListChecks className="h-3.5 w-3.5" />
            {subtaskDone}/{subtaskTotal}
          </span>
        )}
      </div>

      {/* Metadata cells grouped tightly so they read as one strip; widths
          are matched by the header's matching sub-flex. */}
      <div className="shrink-0 flex items-center gap-1.5">
        {/* Assignee */}
        <div className={cn("shrink-0", COLUMN_WIDTHS.assignee)}>
          <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={stopRowClick}
                onKeyDown={stopRowClick}
                className="w-full flex items-center gap-1.5 rounded-md px-1 -mx-1 py-0.5 hover:bg-accent text-left transition-colors"
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
        </div>

        {/* Due date */}
        <div className={cn("shrink-0", COLUMN_WIDTHS.due)}>
          <Popover open={dueOpen} onOpenChange={setDueOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={stopRowClick}
                onKeyDown={stopRowClick}
                className="w-full flex items-center text-xs whitespace-nowrap rounded-md px-1 -mx-1 py-0.5 hover:bg-accent text-left transition-colors"
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
        </div>

        {/* Created by */}
        <div
          className={cn(
            "shrink-0 flex items-center gap-1.5",
            COLUMN_WIDTHS.createdBy
          )}
        >
          {creator ? (
            <>
              <Avatar className="h-6 w-6 shrink-0" title={creator.full_name ?? undefined}>
                <AvatarFallback className={cn("text-[10px]", avatarColor(creator.id))}>
                  {initials(creator.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs truncate">
                {creator.full_name ?? "Unnamed"}
              </span>
            </>
          ) : (
            <EmptyCell />
          )}
        </div>

        {/* Priority */}
        <div className={cn("shrink-0 flex items-center", COLUMN_WIDTHS.priority)}>
          {priority ? (
            <Badge
              variant="outline"
              className={cn("h-5 text-[10px] uppercase", priority.className)}
            >
              {priority.label}
            </Badge>
          ) : (
            <EmptyCell />
          )}
        </div>
      </div>
    </div>
  );
}

// Subtle em-dash for empty cells — keeps columns visually aligned without
// blank gaps that look like missing data.
function EmptyCell() {
  return <span className="text-muted-foreground/30 text-xs">—</span>;
}

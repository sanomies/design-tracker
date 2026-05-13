import { format, isToday, isTomorrow, isYesterday, parseISO } from "date-fns";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useWorkspaceMembers } from "@/features/workspaces/useWorkspaceMembers";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/database";

import { priorityMeta } from "./priority";
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
}: {
  task: Task;
  workspaceId: string | undefined;
  selected: boolean;
  onSelect: () => void;
}) {
  const updateTask = useUpdateTask(task.project_id);
  const { data: members } = useWorkspaceMembers(workspaceId);
  const assignee = members?.find((m) => m.id === task.assignee_id);
  const priority = priorityMeta(task.priority);
  const due = task.due_date ? formatDueDate(task.due_date) : null;
  const done = task.status === "done";

  const toggleDone = () => {
    updateTask.mutate({
      id: task.id,
      patch: { status: done ? "todo" : "done" },
    });
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
      />

      <span
        className={cn(
          "flex-1 text-sm truncate",
          done && "line-through text-muted-foreground"
        )}
      >
        {task.title}
      </span>

      {priority && (
        <Badge variant="outline" className={cn("h-5 text-[10px] uppercase", priority.className)}>
          {priority.label}
        </Badge>
      )}

      {due && (
        <span
          className={cn(
            "text-xs whitespace-nowrap",
            due.tone === "past" && "text-destructive",
            due.tone === "today" && "text-amber-600 font-medium",
            due.tone === "soon" && "text-foreground",
            due.tone === "later" && "text-muted-foreground"
          )}
        >
          {due.label}
        </span>
      )}

      <Avatar className="h-6 w-6">
        <AvatarFallback className="text-[10px]">
          {assignee ? initials(assignee.full_name) : "—"}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}

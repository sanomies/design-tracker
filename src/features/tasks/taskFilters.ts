import {
  endOfWeek,
  isToday,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";

import type { Task, TaskPriority } from "@/types/database";

/**
 * Tailwind width classes used by both the column header row and TaskRow's
 * right-side cells. Keeping them here means changing a width changes both
 * places in lockstep. Sized tight so the metadata reads as one grouped
 * strip instead of spread-out columns.
 */
export const COLUMN_WIDTHS = {
  // Assignee and Created by show "avatar + full name (truncated)" — width
  // fits the avatar plus ~8 chars before truncation kicks in.
  assignee: "w-28",
  due: "w-16",
  createdBy: "w-28",
  priority: "w-16",
} as const;

export type DueDatePreset = "all" | "overdue" | "today" | "this-week" | "none";

export type Filters = {
  /** null = no filter. Strings are member ids; null in the set = unassigned. */
  assignee: Set<string | null> | null;
  /** null = no filter. */
  createdBy: Set<string> | null;
  /** null = no filter. "none" in the set = tasks with no priority. */
  priority: Set<TaskPriority | "none"> | null;
  /** "all" = no filter. */
  dueDate: DueDatePreset;
};

export const defaultFilters: Filters = {
  assignee: null,
  createdBy: null,
  priority: null,
  dueDate: "all",
};

export function hasActiveFilter(f: Filters): boolean {
  return (
    f.assignee !== null ||
    f.createdBy !== null ||
    f.priority !== null ||
    f.dueDate !== "all"
  );
}

export function matchesFilters(t: Task, f: Filters): boolean {
  if (f.assignee && !f.assignee.has(t.assignee_id ?? null)) return false;
  if (f.createdBy) {
    if (!t.created_by || !f.createdBy.has(t.created_by)) return false;
  }
  if (f.priority) {
    const key: TaskPriority | "none" = t.priority ?? "none";
    if (!f.priority.has(key)) return false;
  }
  if (f.dueDate !== "all") {
    const due = t.due_date ? parseISO(t.due_date) : null;
    if (f.dueDate === "none") {
      if (due !== null) return false;
    } else {
      if (!due) return false;
      const today = startOfDay(new Date());
      if (f.dueDate === "overdue" && due >= today) return false;
      if (f.dueDate === "today" && !isToday(due)) return false;
      if (f.dueDate === "this-week") {
        const start = startOfWeek(today, { weekStartsOn: 1 });
        const end = endOfWeek(today, { weekStartsOn: 1 });
        if (!isWithinInterval(due, { start, end })) return false;
      }
    }
  }
  return true;
}

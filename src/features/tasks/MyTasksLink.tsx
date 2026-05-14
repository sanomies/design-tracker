import { NavLink } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

import { useMyTasks } from "./useMyTasks";

/**
 * Sidebar nav row that links to /my-tasks. Shows the count of active
 * (non-done) assigned tasks as a right-aligned pill, mirroring InboxLink.
 */
export function MyTasksLink() {
  const { data: tasks } = useMyTasks();
  const activeCount = (tasks ?? []).filter((t) => t.status !== "done").length;

  return (
    <NavLink
      to="/my-tasks"
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
          isActive
            ? "bg-accent text-accent-foreground"
            : "hover:bg-accent/50"
        )
      }
      aria-label={activeCount > 0 ? `My tasks (${activeCount})` : "My tasks"}
    >
      <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex-1 truncate">My tasks</span>
      {activeCount > 0 && (
        <span
          className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-muted text-foreground text-[10px] font-semibold px-1.5"
          aria-hidden
        >
          {activeCount > 99 ? "99+" : activeCount}
        </span>
      )}
    </NavLink>
  );
}

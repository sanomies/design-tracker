import { NavLink } from "react-router-dom";

import { IconCircleCheck } from "@/components/icons/figma";
import { cn } from "@/lib/utils";

import { useMyTasks } from "./useMyTasks";

/**
 * Sidebar nav row that links to /my-tasks. Shows the count of active
 * (non-done) assigned tasks as a right-aligned pill.
 */
export function MyTasksLink() {
  const { data: tasks } = useMyTasks();
  const activeCount = (tasks ?? []).filter((t) => t.status !== "done").length;

  return (
    <NavLink
      to="/my-tasks"
      end
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 rounded-lg p-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-[#EDF2F4] text-foreground"
            : "hover:bg-[#EDF2F4]/60 text-foreground"
        )
      }
      aria-label={activeCount > 0 ? `My tasks (${activeCount})` : "My tasks"}
    >
      <IconCircleCheck className="h-6 w-6 text-foreground" />
      <span className="flex-1 truncate">My tasks</span>
      {activeCount > 0 && (
        // Pill structure kept (`h-6 min-w-[24px] rounded-full`) so the row
        // height is consistent with Inbox above, but bg is transparent and
        // text is the muted #708597 — per the redesigned sidebar, only the
        // Inbox unread count is prominent.
        <span
          className="inline-flex min-w-[24px] h-6 items-center justify-center rounded-full px-1.5 text-[12px] font-bold text-[#708597]"
          aria-hidden
        >
          {activeCount > 99 ? "99+" : activeCount}
        </span>
      )}
    </NavLink>
  );
}

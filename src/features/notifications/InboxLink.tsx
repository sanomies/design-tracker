import { NavLink } from "react-router-dom";
import { Bell } from "lucide-react";

import { cn } from "@/lib/utils";

import { useNotifications } from "./useNotifications";

/**
 * Full-width sidebar nav row that links to /inbox. Shows the unread count
 * as a right-aligned pill, with the active route getting an accent
 * background like other sidebar items.
 */
export function InboxLink() {
  const { data: notifications } = useNotifications();
  const unread = (notifications ?? []).filter((n) => !n.read_at).length;

  return (
    <NavLink
      to="/inbox"
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
          isActive
            ? "bg-accent text-accent-foreground"
            : "hover:bg-accent/50"
        )
      }
      aria-label={unread > 0 ? `Inbox (${unread} unread)` : "Inbox"}
    >
      <Bell className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex-1 truncate">Inbox</span>
      {unread > 0 && (
        <span
          className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold px-1.5"
          aria-hidden
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </NavLink>
  );
}

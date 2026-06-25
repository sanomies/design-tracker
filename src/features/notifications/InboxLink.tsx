import { NavLink } from "react-router-dom";

import { IconBell } from "@/components/icons/figma";
import { cn } from "@/lib/utils";

import { useNotifications } from "./useNotifications";

/**
 * Full-width sidebar nav row that links to /inbox. Shows the unread count
 * as a right-aligned pill.
 */
export function InboxLink() {
  const { data: notifications } = useNotifications();
  const unread = (notifications ?? []).filter((n) => !n.read_at).length;

  return (
    <NavLink
      to="/inbox"
      end
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 rounded-lg p-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-[#EDF2F4] text-foreground"
            : "hover:bg-[#EDF2F4]/60 active:bg-[#EDF2F4]/60 text-foreground"
        )
      }
      aria-label={unread > 0 ? `Inbox (${unread} unread)` : "Inbox"}
    >
      <IconBell className="h-6 w-6 text-foreground" />
      <span className="flex-1 truncate">Inbox</span>
      {unread > 0 && (
        <span
          className="inline-flex min-w-[24px] h-6 items-center justify-center rounded-full bg-foreground px-1.5 text-[12px] font-bold text-background"
          aria-hidden
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </NavLink>
  );
}

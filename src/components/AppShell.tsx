import { Outlet } from "react-router-dom";

import { MobileBottomNav } from "@/components/MobileNav";
import { Sidebar } from "@/components/Sidebar";
import { useAppBadge } from "@/features/notifications/useAppBadge";
import { useIsMobile } from "@/hooks/useIsMobile";

export function AppShell() {
  const isMobile = useIsMobile();
  // Reflect the inbox unread count on the installed-app (PWA) icon badge.
  useAppBadge();

  if (isMobile) {
    return (
      <div className="h-dvh flex flex-col overflow-hidden">
        <main className="flex-1 min-w-0 overflow-y-auto">
          <Outlet />
        </main>
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="h-dvh flex overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

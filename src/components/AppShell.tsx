import { Outlet } from "react-router-dom";

import { MobileBottomNav } from "@/components/MobileNav";
import { Sidebar } from "@/components/Sidebar";
import { useIsMobile } from "@/hooks/useIsMobile";

export function AppShell() {
  const isMobile = useIsMobile();

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

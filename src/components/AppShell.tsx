import { Outlet } from "react-router-dom";

import { Sidebar } from "@/components/Sidebar";

export function AppShell() {
  return (
    <div className="h-dvh flex overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

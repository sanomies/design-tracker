import { Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/features/auth/AuthProvider";
import LoginPage from "@/features/auth/LoginPage";
import SignupPage from "@/features/auth/SignupPage";
import { CurrentWorkspaceProvider } from "@/features/workspaces/CurrentWorkspaceProvider";
import AcceptInvitePage from "@/routes/AcceptInvitePage";
import EmailSettingsPage from "@/routes/EmailSettingsPage";
import HomeEmpty from "@/routes/HomeEmpty";
import InboxPage from "@/routes/InboxPage";
import MyTasksPage from "@/routes/MyTasksPage";
import ProjectView from "@/routes/ProjectView";
import UnsubscribePage from "@/routes/UnsubscribePage";

export default function App() {
  return (
    <AuthProvider>
      <CurrentWorkspaceProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/invite/:token" element={<AcceptInvitePage />} />
          <Route path="/unsubscribe" element={<UnsubscribePage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<HomeEmpty />} />
              <Route path="/inbox" element={<InboxPage />} />
              <Route path="/my-tasks" element={<MyTasksPage />} />
              <Route path="/projects/:projectId" element={<ProjectView />} />
              <Route path="/settings/email" element={<EmailSettingsPage />} />
            </Route>
          </Route>
        </Routes>
        <Toaster richColors position="bottom-right" />
      </CurrentWorkspaceProvider>
    </AuthProvider>
  );
}

import { Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/features/auth/AuthProvider";
import LoginPage from "@/features/auth/LoginPage";
import SignupPage from "@/features/auth/SignupPage";
import HomeEmpty from "@/routes/HomeEmpty";
import ProjectView from "@/routes/ProjectView";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomeEmpty />} />
            <Route path="/projects/:projectId" element={<ProjectView />} />
          </Route>
        </Route>
      </Routes>
      <Toaster richColors position="bottom-right" />
    </AuthProvider>
  );
}

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FolderOpen } from "lucide-react";

import { useProjects } from "@/features/projects/useProjects";
import { useWorkspace } from "@/features/workspaces/useWorkspace";

import { LAST_PROJECT_STORAGE_PREFIX } from "./ProjectView";

export default function HomeEmpty() {
  const navigate = useNavigate();
  const { data: workspace } = useWorkspace();
  const { data: projects } = useProjects(workspace?.id);

  // On landing at "/", if we have a remembered project for the current
  // workspace AND it still exists, route straight there. Otherwise fall
  // back to the empty state below.
  useEffect(() => {
    if (!workspace || !projects) return;
    let saved: string | null;
    try {
      saved = localStorage.getItem(
        `${LAST_PROJECT_STORAGE_PREFIX}${workspace.id}`
      );
    } catch {
      return;
    }
    if (!saved) return;
    if (!projects.some((p) => p.id === saved)) return;
    navigate(`/projects/${saved}`, { replace: true });
  }, [workspace?.id, projects, navigate]);

  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-2">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <FolderOpen className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>
        <h2 className="text-lg font-semibold">Select a project</h2>
        <p className="text-sm text-muted-foreground">
          Pick a project from the sidebar, or create your first one to start tracking work.
        </p>
      </div>
    </div>
  );
}

import { FolderOpen } from "lucide-react";

export default function HomeEmpty() {
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

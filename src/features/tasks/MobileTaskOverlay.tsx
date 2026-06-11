import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import type { Task } from "@/types/database";

import { TaskDetailPanel } from "./TaskDetailPanel";

const DURATION_MS = 300;

/**
 * Fullscreen mobile task detail. Slides in from the right on open and slides
 * back out to the right on close, stopping above the bottom tab bar so the
 * nav stays visible.
 *
 * Pass the currently-selected task (or null). To animate the close we can't
 * just unmount on null — React would drop the node instantly. Instead we
 * freeze the last task and keep rendering it (with the slide-out animation)
 * for DURATION_MS before unmounting. `fill-mode:forwards` holds it off-screen
 * so it doesn't snap back for a frame right before it disappears.
 */
export function MobileTaskOverlay({
  task,
  workspaceId,
  onClose,
}: {
  task: Task | null;
  workspaceId: string | undefined;
  onClose: () => void;
}) {
  const [frozen, setFrozen] = useState<{ task: Task; workspaceId?: string } | null>(
    task ? { task, workspaceId } : null
  );
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (task) {
      setFrozen({ task, workspaceId });
      setClosing(false);
      return;
    }
    if (!frozen) return;
    // task went null → play the slide-out, then unmount.
    setClosing(true);
    const t = window.setTimeout(() => {
      setFrozen(null);
      setClosing(false);
    }, DURATION_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, workspaceId]);

  if (!frozen) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 top-0 z-50 overflow-hidden bg-background",
        "bottom-[calc(3.5rem+env(safe-area-inset-bottom))]",
        closing
          ? "animate-out slide-out-to-right duration-300 ease-in [animation-fill-mode:forwards]"
          : "animate-in slide-in-from-right duration-300 ease-out"
      )}
    >
      <TaskDetailPanel
        key={frozen.task.id}
        task={frozen.task}
        workspaceId={frozen.workspaceId}
        onClose={onClose}
        isFullscreen
      />
    </div>
  );
}

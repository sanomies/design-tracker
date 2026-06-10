import type { ReactNode } from "react";
import {
  defaultAnimateLayoutChanges,
  useSortable,
  type AnimateLayoutChanges,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "@/lib/utils";

/** Sortable id prefix for section rows — keeps them in their own namespace
 *  so the drag-end handler can tell sections apart from tasks (which use
 *  bare UUIDs). */
export function sectionRowId(sectionId: string): string {
  return `section-row:${sectionId}`;
}

// Skip the post-drop "settle" animation on the just-dropped section.
// Without this the section briefly snaps back to its source slot after
// release before sliding to the dropped position. See SortableTaskRow
// for the same fix.
const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  args.wasDragging ? false : defaultAnimateLayoutChanges(args);

/**
 * Wraps a section render in a sortable container. The drag listeners are
 * NOT applied to the wrapper — they get passed through to the section
 * header so a click anywhere INSIDE the section (e.g. on a task row, or
 * its embedded SortableContext) doesn't start a section-level drag.
 *
 * Source slot stays in place with a dashed dimmed outline while a
 * DragOverlay copy (rendered by TaskList) follows the cursor.
 */
export function SortableSection({
  sectionId,
  children,
}: {
  sectionId: string;
  children: (args: {
    dragListeners: ReturnType<typeof useSortable>["listeners"];
  }) => ReactNode;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({
      id: sectionRowId(sectionId),
      data: { type: "section", sectionId },
      animateLayoutChanges,
    });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        // Source section slot dims while dragging — the visible "lifted"
        // copy is rendered separately by the DragOverlay in TaskList.
        isDragging &&
          "opacity-30 outline outline-2 outline-dashed outline-foreground/20 -outline-offset-2 rounded-md"
      )}
      {...attributes}
    >
      {children({ dragListeners: listeners })}
    </div>
  );
}

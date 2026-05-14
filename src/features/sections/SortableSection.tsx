import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "@/lib/utils";

/** Sortable id prefix for section rows — keeps them in their own namespace
 *  so the drag-end handler can tell sections apart from tasks (which use
 *  bare UUIDs). */
export function sectionRowId(sectionId: string): string {
  return `section-row:${sectionId}`;
}

/**
 * Wraps a section render in a sortable container. The drag listeners are
 * NOT applied to the wrapper — they get passed through to the grip handle
 * inside the section header so that clicking the chevron, name, or actions
 * menu doesn't start a drag.
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
    });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        isDragging &&
          "opacity-30 outline outline-2 outline-dashed outline-foreground/20 -outline-offset-2 rounded-md"
      )}
      {...attributes}
    >
      {children({ dragListeners: listeners })}
    </div>
  );
}

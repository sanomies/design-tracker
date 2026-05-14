import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "@/lib/utils";
import type { Task } from "@/types/database";

/**
 * Wraps a TaskRow in an `<li>` that participates in @dnd-kit's sortable
 * system. The whole row is the drag target, but the activation constraint
 * (set on PointerSensor at the DndContext level) makes <8px of movement
 * a click instead of a drag — so opening the detail panel still works.
 */
export function SortableTaskRow({
  task,
  children,
  sectionId,
}: {
  task: Task;
  children: ReactNode;
  /** Override which section id the drop-target machinery sees. Defaults to
   *  `task.section_id` (project sections). My Tasks passes `my_section_id`
   *  so its personal sections drive the drop logic. */
  sectionId?: string | null;
}) {
  const effectiveSectionId = sectionId !== undefined ? sectionId : task.section_id ?? null;
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({
      id: task.id,
      // Carry the source section so onDragEnd can read it without re-walking
      // the task list.
      data: { type: "task", sectionId: effectiveSectionId },
    });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        // While the row is being dragged, the DragOverlay renders a copy
        // that follows the cursor. The source becomes a flat dashed slot
        // so it's obvious it's a placeholder and not the actual item.
        isDragging &&
          "opacity-30 outline outline-2 outline-dashed outline-foreground/20 -outline-offset-2"
      )}
      {...attributes}
      {...listeners}
    >
      {children}
    </li>
  );
}

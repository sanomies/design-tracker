import type { ReactNode } from "react";
import {
  defaultAnimateLayoutChanges,
  useSortable,
  type AnimateLayoutChanges,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "@/lib/utils";
import type { Task } from "@/types/database";

// Skip the post-drop "settle" animation on the just-dropped item.
// Without this, dnd-kit animates the row from its old DOM slot to its
// new one after the optimistic cache reorder lands — so on release the
// row appears to snap back to the source position for a frame and then
// slide to the dropped position. `wasDragging` is true only on the
// frame the drop is committed, so non-dragged rows still animate
// smoothly when their layout changes for other reasons.
const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  args.wasDragging ? false : defaultAnimateLayoutChanges(args);

/**
 * Wraps a TaskRow in an `<li>` that participates in @dnd-kit's sortable
 * system. The whole row is the drag target: the DndContext's 8px
 * activation distance keeps quick clicks intact (selecting / opening the
 * detail panel), and only deliberate drags reorder.
 *
 * Uses the classic DragOverlay pattern — the source row stays in place
 * as a dimmed "slot" while a separately-rendered overlay copy follows
 * the cursor. The "follow the cursor with the source row" pattern was
 * unstable here: with the section wrappers above each task in the DOM,
 * dnd-kit's verticalListSortingStrategy occasionally computed an over
 * index that didn't match the rendered position, producing visible
 * jitter / jump-back during drag.
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
      animateLayoutChanges,
    });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        // While the row is being dragged, the DragOverlay (rendered up
        // in TaskList) carries the visible "lifted" copy that follows
        // the cursor. The source slot stays at its original position
        // with a dimmed placeholder so the user can see exactly where
        // the row will land if they cancel.
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

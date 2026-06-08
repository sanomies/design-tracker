import { useRef, useState, type ReactNode } from "react";
import { useDroppable, type DraggableSyntheticListeners } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Pencil, Trash2 } from "lucide-react";

import { IconChevronDown, IconMoreHorizontal } from "@/components/icons/figma";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Section, Task } from "@/types/database";

/** Droppable id format used by both SectionBlock and TaskList's drag-end
 *  handler. Sections are addressed by id; `null` is the un-sectioned bucket. */
export function sectionDroppableId(sectionId: string | null): string {
  return sectionId ? `section:${sectionId}` : "section:null";
}

export type SectionBlockProps = {
  /** `null` renders the un-sectioned group: no header, no inline-add. Pass
   *  `pinnedHeaderLabel` alongside to give the unsectioned bucket a fixed,
   *  uneditable header (used for "Unassigned" on My Tasks). */
  section: Section | null;
  tasks: Task[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onRenameClick: () => void;
  onDeleteClick: () => void;
  /** Returning a Promise is supported so the caller can do work (e.g.
   *  selecting the new task) and the form keeps its draft until it resolves. */
  onAddTask: (title: string) => void | Promise<void>;
  renderRow: (task: Task) => ReactNode;
  /** When provided, a grip handle is rendered in the section header and
   *  these listeners are attached to it — that's the only element that
   *  starts a section drag. The rest of the header stays clickable. */
  dragListeners?: DraggableSyntheticListeners;
  /** Suppress the inline "+ Add task" button (used by My Tasks view where
   *  tasks can't be created — they enter the view via assignment). */
  hideAddTask?: boolean;
  /** When `section` is null, render a synthetic header with this label.
   *  No grip handle, no rename/delete menu — it can only be collapsed. */
  pinnedHeaderLabel?: string;
};

export function SectionBlock({
  section,
  tasks,
  collapsed,
  onToggleCollapsed,
  onRenameClick,
  onDeleteClick,
  onAddTask,
  renderRow,
  dragListeners,
  hideAddTask = false,
  pinnedHeaderLabel,
}: SectionBlockProps) {
  const hasHeader = !!section || !!pinnedHeaderLabel;
  const showActionsMenu = !!section;
  const headerLabel = section?.name ?? pinnedHeaderLabel ?? "";
  // For real sections only — the un-sectioned group adds via the top combo.
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // The section's container is itself a droppable so empty sections can
  // receive drops. The id encodes the (possibly-null) section id; the
  // drag-end handler decodes it.
  const sectionId = section?.id ?? null;
  const { setNodeRef: dropRef, isOver } = useDroppable({
    id: sectionDroppableId(sectionId),
    data: { type: "section", sectionId },
  });

  const startAdding = () => {
    setAdding(true);
    // useRef is set on next paint; defer focus until the input mounts.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const submitDraft = async () => {
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    // Keep the input focused so users can rapidly add several. The caller
    // may open the new task's detail panel, but focus stays in the input.
    requestAnimationFrame(() => inputRef.current?.focus());
    await onAddTask(t);
  };

  return (
    <section
      ref={dropRef}
      className={cn(
        "transition-colors",
        // Vertical breathing room around any header — keeps real sections
        // and the pinned Unassigned bucket reading as distinct blocks. The
        // truly headerless variant (project view's unsectioned group)
        // stays flush with the input above it.
        hasHeader && "pt-6 pb-2",
        isOver && "bg-primary/5"
      )}
    >
      {hasHeader && (
        <header className="group flex items-center gap-2 px-2 py-2 hover:bg-[#EDF2F4]/60 rounded-md transition-colors mx-2">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="h-[18px] w-[18px] flex items-center justify-center text-foreground/80 hover:text-foreground rounded"
            aria-label={collapsed ? "Expand section" : "Collapse section"}
          >
            <IconChevronDown
              className={cn(
                "h-[18px] w-[18px] transition-transform",
                collapsed && "-rotate-90"
              )}
            />
          </button>
          <h3 className="text-lg font-semibold truncate" title={headerLabel}>
            {headerLabel}
          </h3>
          <span className="text-sm text-[#708597] ml-1">{tasks.length}</span>

          {showActionsMenu && (
            <div className="ml-auto opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label={`Actions for ${headerLabel}`}
                  >
                    <IconMoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={onRenameClick}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Rename section
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={onDeleteClick}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete section
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </header>
      )}

      {(!hasHeader || !collapsed) && (
        <>
          <SortableContext
            items={tasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="divide-y-0 min-h-[8px]">
              {tasks.map((task) => renderRow(task))}
            </ul>
          </SortableContext>

          {section && !hideAddTask && (
            <div className="px-3 py-1">
              {adding ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitDraft();
                  }}
                >
                  <Input
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => {
                      if (!draft.trim()) setAdding(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setDraft("");
                        setAdding(false);
                      }
                    }}
                    placeholder="Add a task — press Enter"
                    className="h-8 text-sm"
                    autoComplete="off"
                  />
                </form>
              ) : (
                <button
                  type="button"
                  onClick={startAdding}
                  className="text-xs text-muted-foreground hover:text-foreground py-1 px-1"
                >
                  + Add task
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

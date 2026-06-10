import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TaskPriority } from "@/types/database";

import { PRIORITIES } from "./priority";

/**
 * Popover content for choosing a single task priority. Mirrors the
 * structure of TypePickerContent — a "Clear" row first, then a flat
 * list of the three named priorities rendered as their own pills so
 * the picker reads as a swatch of options.
 *
 * Callers wrap in a Popover with whatever trigger they need (full-width
 * button in the detail panel, compact cell in a list row).
 */
export function PriorityPickerContent({
  value,
  onChange,
  onClose,
}: {
  value: TaskPriority | null;
  onChange: (next: TaskPriority | null) => void;
  onClose: () => void;
}) {
  const commit = (next: TaskPriority | null) => {
    onChange(next);
    onClose();
  };

  return (
    <div className="flex flex-col">
      <button
        type="button"
        className={cn(
          "w-full flex items-center rounded px-2 py-1.5 text-sm hover:bg-accent",
          value === null && "bg-accent font-medium"
        )}
        onClick={() => commit(null)}
      >
        No priority
      </button>
      {PRIORITIES.map((p) => (
        <button
          key={p.value}
          type="button"
          className={cn(
            "w-full flex items-center rounded px-2 py-1.5 text-sm hover:bg-accent",
            value === p.value && "bg-accent font-medium"
          )}
          onClick={() => commit(p.value)}
        >
          <Badge
            variant="outline"
            className={cn("h-5 text-[10px] uppercase", p.className)}
          >
            {p.label}
          </Badge>
        </button>
      ))}
    </div>
  );
}

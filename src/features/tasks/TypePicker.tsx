import { cn } from "@/lib/utils";

import { TASK_TYPES } from "./taskTypes";

/**
 * Popover content for choosing a task type. Simpler than the publication
 * picker — the type catalog has a handful of entries so no type-ahead /
 * keyboard nav is needed. Mirrors the visual treatment used in the
 * assignee + priority cells: "Clear" row first, then a flat list.
 *
 * Callers wrap this in a Popover (full-width trigger in the detail panel,
 * compact cell trigger in a list row) — no built-in trigger here.
 */
export function TypePickerContent({
  value,
  onChange,
  onClose,
}: {
  value: string | null;
  onChange: (slug: string | null) => void;
  onClose: () => void;
}) {
  const commit = (slug: string | null) => {
    onChange(slug);
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
        No type
      </button>
      {TASK_TYPES.map((t) => (
        <button
          key={t.slug}
          type="button"
          className={cn(
            "w-full flex items-center rounded px-2 py-1.5 text-sm hover:bg-accent",
            value === t.slug && "bg-accent font-medium"
          )}
          onClick={() => commit(t.slug)}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}

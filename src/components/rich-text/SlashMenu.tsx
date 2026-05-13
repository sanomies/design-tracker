import { forwardRef, useEffect, useImperativeHandle, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type SlashItem = {
  id: string;
  label: string;
  hint?: string;
  icon: ReactNode;
};

export type SlashMenuHandle = {
  onKeyDown: (event: KeyboardEvent) => boolean;
};

type Props = {
  items: SlashItem[];
  command: (item: SlashItem) => void;
};

export const SlashMenu = forwardRef<SlashMenuHandle, Props>(({ items, command }, ref) => {
  const [selected, setSelected] = useState(0);

  // Reset selection when the items list changes (typing filters the list).
  useEffect(() => setSelected(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (items.length === 0) {
        // Let Escape close via TipTap's default handling, swallow Enter so it
        // doesn't drop a newline while the menu is on screen with no matches.
        if (event.key === "Enter") return true;
        return false;
      }
      if (event.key === "ArrowUp") {
        setSelected((i) => (i + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelected((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        const item = items[selected];
        if (item) command(item);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="rounded-md border bg-popover shadow-md p-2 text-xs text-muted-foreground min-w-[220px]">
        No matching commands
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-popover shadow-md p-1 min-w-[240px] max-h-72 overflow-y-auto">
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          onClick={() => command(item)}
          onMouseEnter={() => setSelected(index)}
          className={cn(
            "w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm text-left",
            index === selected ? "bg-accent" : "hover:bg-accent/50"
          )}
        >
          <span className="text-muted-foreground shrink-0">{item.icon}</span>
          <span className="flex-1 truncate">{item.label}</span>
          {item.hint && (
            <span className="text-[11px] text-muted-foreground shrink-0">{item.hint}</span>
          )}
        </button>
      ))}
    </div>
  );
});

SlashMenu.displayName = "SlashMenu";

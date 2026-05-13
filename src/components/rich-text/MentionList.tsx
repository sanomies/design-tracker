import { forwardRef, useEffect, useImperativeHandle, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type MentionItem = { id: string; label: string };

type Props = {
  items: MentionItem[];
  command: (item: MentionItem) => void;
};

export type MentionListHandle = {
  onKeyDown: (event: KeyboardEvent) => boolean;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export const MentionList = forwardRef<MentionListHandle, Props>(({ items, command }, ref) => {
  const [selected, setSelected] = useState(0);

  // Reset selection when the items list changes (typing filters the list).
  useEffect(() => setSelected(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (items.length === 0) return false;
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
      <div className="rounded-md border bg-popover shadow-md p-2 text-xs text-muted-foreground min-w-[180px]">
        No matches
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-popover shadow-md p-1 min-w-[200px] max-h-64 overflow-y-auto">
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
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[10px]">{initials(item.label)}</AvatarFallback>
          </Avatar>
          <span className="truncate">{item.label}</span>
        </button>
      ))}
    </div>
  );
});

MentionList.displayName = "MentionList";

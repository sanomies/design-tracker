import { useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { avatarColor } from "@/lib/avatarColor";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Popover content for choosing a task assignee. The picker itself doesn't
 * own a trigger — callers wrap it however they want (full-width button in
 * the detail panel, just the avatar in a row, etc.).
 */
export function AssigneePickerContent({
  members,
  value,
  onChange,
  onClose,
}: {
  members: Profile[];
  value: string | null;
  onChange: (id: string | null) => void;
  onClose: () => void;
}) {
  return (
    <>
      <button
        type="button"
        className={cn(
          "w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent",
          value === null && "bg-accent"
        )}
        onClick={() => {
          onChange(null);
          onClose();
        }}
      >
        <Avatar className="h-5 w-5">
          <AvatarFallback className="text-[10px]">—</AvatarFallback>
        </Avatar>
        Unassigned
      </button>
      {members.map((m) => (
        <button
          key={m.id}
          type="button"
          className={cn(
            "w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent",
            value === m.id && "bg-accent"
          )}
          onClick={() => {
            onChange(m.id);
            onClose();
          }}
        >
          <Avatar className="h-5 w-5">
            <AvatarFallback className={cn("text-[10px]", avatarColor(m.id))}>
              {initials(m.full_name)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{m.full_name ?? "Unnamed"}</span>
        </button>
      ))}
    </>
  );
}

/**
 * Default full-width Popover trigger — used by the task detail panel.
 * In compact contexts (task rows), wrap AssigneePickerContent in a Popover
 * with a custom trigger instead of using this.
 */
export function AssigneePicker({
  members,
  value,
  onChange,
}: {
  members: Profile[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = members.find((m) => m.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start font-normal">
          <Avatar className="h-5 w-5 mr-2">
            <AvatarFallback
              className={cn("text-[10px]", current && avatarColor(current.id))}
            >
              {current ? initials(current.full_name) : "—"}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">
            {current ? current.full_name ?? "Unnamed" : "Unassigned"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-1 w-56">
        <AssigneePickerContent
          members={members}
          value={value}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

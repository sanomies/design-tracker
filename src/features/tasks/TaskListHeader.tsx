import type { ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarColor } from "@/lib/avatarColor";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkspaceMembers } from "@/features/workspaces/useWorkspaceMembers";
import { cn } from "@/lib/utils";
import type { Profile, TaskPriority } from "@/types/database";

import { PRIORITIES } from "./priority";
import {
  COLUMN_WIDTHS,
  type DueDatePreset,
  type Filters,
} from "./taskFilters";

type Props = {
  workspaceId: string | undefined;
  filters: Filters;
  onChange: (next: Filters) => void;
};

export function TaskListHeader({ workspaceId, filters, onChange }: Props) {
  const { data: members = [] } = useWorkspaceMembers(workspaceId);

  return (
    <div className="shrink-0 flex items-center gap-3 px-3 py-1.5 border-b bg-[#F5F7FA] text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {/* Checkbox spacer + Name */}
      <span className="w-4 shrink-0" aria-hidden />
      <span className="flex-1 min-w-0">Name</span>

      {/* Metadata columns kept together as one tight strip — the row's
          cells use a matching sub-flex so widths stay aligned. */}
      <div className="shrink-0 flex items-center gap-1.5">
        <ColumnHeader
          label="Assignee"
          active={filters.assignee !== null}
          className={COLUMN_WIDTHS.assignee}
        >
          <MemberFilter
            members={members}
            allowUnassigned
            selected={filters.assignee}
            onChange={(next) => onChange({ ...filters, assignee: next })}
          />
        </ColumnHeader>

        <ColumnHeader
          label="Due date"
          active={filters.dueDate !== "all"}
          className={COLUMN_WIDTHS.due}
        >
          <DueDateFilter
            value={filters.dueDate}
            onChange={(next) => onChange({ ...filters, dueDate: next })}
          />
        </ColumnHeader>

        <ColumnHeader
          label="Created by"
          active={filters.createdBy !== null}
          className={COLUMN_WIDTHS.createdBy}
        >
          <MemberFilter
            members={members}
            selected={
              filters.createdBy
                ? (new Set<string | null>(filters.createdBy) as Set<string | null>)
                : null
            }
            onChange={(next) => {
              if (!next) {
                onChange({ ...filters, createdBy: null });
                return;
              }
              const set = new Set<string>();
              next.forEach((v) => {
                if (typeof v === "string") set.add(v);
              });
              onChange({ ...filters, createdBy: set });
            }}
          />
        </ColumnHeader>

        <ColumnHeader
          label="Priority"
          active={filters.priority !== null}
          className={COLUMN_WIDTHS.priority}
        >
          <PriorityFilter
            selected={filters.priority}
            onChange={(next) => onChange({ ...filters, priority: next })}
          />
        </ColumnHeader>
      </div>
    </div>
  );
}

// --- Reusable column header trigger ----------------------------------

function ColumnHeader({
  label,
  active,
  className,
  children,
}: {
  label: string;
  active: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "shrink-0 flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-foreground hover:bg-accent",
            active && "text-foreground",
            className
          )}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
          {active && (
            <span
              className="h-1.5 w-1.5 rounded-full bg-primary"
              aria-label="Filter active"
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        {children}
      </PopoverContent>
    </Popover>
  );
}

// --- Member multi-select filter (assignee / created by) ---------------

function MemberFilter({
  members,
  selected,
  allowUnassigned = false,
  onChange,
}: {
  members: Profile[];
  selected: Set<string | null> | null;
  allowUnassigned?: boolean;
  onChange: (next: Set<string | null> | null) => void;
}) {
  const toggle = (id: string | null) => {
    const next = new Set(selected ?? []);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next.size > 0 ? next : null);
  };

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          "flex items-center gap-2 rounded px-2 py-1.5 text-sm normal-case font-normal hover:bg-accent",
          selected === null && "text-foreground"
        )}
      >
        <span className="w-3.5" />
        Anyone
      </button>
      <div className="h-px bg-border my-1" />
      <div className="max-h-64 overflow-y-auto">
        {allowUnassigned && (
          <FilterRow
            label="Unassigned"
            checked={selected?.has(null) ?? false}
            onToggle={() => toggle(null)}
            leading={
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[10px]">—</AvatarFallback>
              </Avatar>
            }
          />
        )}
        {members.map((m) => (
          <FilterRow
            key={m.id}
            label={m.full_name ?? "Unnamed"}
            checked={selected?.has(m.id) ?? false}
            onToggle={() => toggle(m.id)}
            leading={
              <Avatar className="h-5 w-5">
                <AvatarFallback className={cn("text-[10px]", avatarColor(m.id))}>
                  {initials(m.full_name)}
                </AvatarFallback>
              </Avatar>
            }
          />
        ))}
      </div>
    </div>
  );
}

// --- Priority multi-select filter ------------------------------------

function PriorityFilter({
  selected,
  onChange,
}: {
  selected: Set<TaskPriority | "none"> | null;
  onChange: (next: Set<TaskPriority | "none"> | null) => void;
}) {
  const toggle = (key: TaskPriority | "none") => {
    const next = new Set(selected ?? []);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next.size > 0 ? next : null);
  };

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => onChange(null)}
        className="flex items-center gap-2 rounded px-2 py-1.5 text-sm normal-case font-normal hover:bg-accent"
      >
        <span className="w-3.5" />
        Any priority
      </button>
      <div className="h-px bg-border my-1" />
      {PRIORITIES.map((p) => (
        <FilterRow
          key={p.value}
          label={p.label}
          checked={selected?.has(p.value) ?? false}
          onToggle={() => toggle(p.value)}
        />
      ))}
      <FilterRow
        label="No priority"
        checked={selected?.has("none") ?? false}
        onToggle={() => toggle("none")}
      />
    </div>
  );
}

// --- Due date preset filter (single-select) --------------------------

function DueDateFilter({
  value,
  onChange,
}: {
  value: DueDatePreset;
  onChange: (next: DueDatePreset) => void;
}) {
  const options: { value: DueDatePreset; label: string }[] = [
    { value: "all", label: "Any time" },
    { value: "overdue", label: "Overdue" },
    { value: "today", label: "Today" },
    { value: "this-week", label: "This week" },
    { value: "none", label: "No due date" },
  ];
  return (
    <div className="flex flex-col">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className="flex items-center gap-2 rounded px-2 py-1.5 text-sm normal-case font-normal hover:bg-accent"
        >
          <span className="w-3.5 flex items-center justify-center">
            {value === o.value && <Check className="h-3.5 w-3.5" />}
          </span>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// --- Shared filter option row ----------------------------------------

function FilterRow({
  label,
  checked,
  onToggle,
  leading,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  leading?: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className="justify-start gap-2 normal-case font-normal h-8 px-2"
    >
      <span className="w-3.5 flex items-center justify-center">
        {checked && <Check className="h-3.5 w-3.5" />}
      </span>
      {leading}
      <span className="truncate">{label}</span>
    </Button>
  );
}

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarColor } from "@/lib/avatarColor";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkspaceMembers } from "@/features/workspaces/useWorkspaceMembers";
import { cn } from "@/lib/utils";
import type { Profile, TaskPriority } from "@/types/database";

import { PRIORITIES } from "./priority";
import { PUBLICATIONS, PUBLICATION_CATEGORIES } from "./publications";
import {
  COLUMN_LABELS,
  COLUMN_MIN_WIDTHS,
  effectiveColumnWidth,
  setColumnOrder,
  setColumnWidth,
  toggleSort,
  useColumnOrder,
  useColumnWidths,
  type ColumnId,
  type SortState,
} from "./taskColumns";
import { type DueDatePreset, type Filters } from "./taskFilters";

type Props = {
  workspaceId: string | undefined;
  filters: Filters;
  onChange: (next: Filters) => void;
  sort: SortState;
  onSortChange: (next: SortState) => void;
};

export function TaskListHeader({
  workspaceId,
  filters,
  onChange,
  sort,
  onSortChange,
}: Props) {
  const { data: members = [] } = useWorkspaceMembers(workspaceId);
  const order = useColumnOrder();

  // 8px activation distance so a quick click on the header still opens the
  // filter popover; only a deliberate horizontal drag starts a reorder.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = order.indexOf(active.id as ColumnId);
    const to = order.indexOf(over.id as ColumnId);
    if (from === -1 || to === -1) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    setColumnOrder(next);
  };

  return (
    <div className="shrink-0 flex items-stretch gap-3 px-3 py-1.5 border-b bg-[#F5F7FA] text-xs font-medium text-muted-foreground">
      {/* Checkbox spacer + Name */}
      <span className="w-4 shrink-0 self-center" aria-hidden />
      <span className="flex-1 min-w-0 self-center">Name</span>

      {/* Metadata columns kept together as one tight strip — `divide-x` adds
          a 1px vertical rule between each column. The row's cells use a
          matching sub-flex so widths and dividers stay aligned. */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={order} strategy={horizontalListSortingStrategy}>
          {/* `-my-1.5` bleeds the strip past the header's vertical padding
              so the dividers span the full header height and line up
              flush with the row dividers below. */}
          <div className="shrink-0 flex items-stretch divide-x divide-border -my-1.5">
            {order.map((id) => (
              <SortableColumn key={id} id={id}>
                {renderHeaderCell(id, filters, onChange, members, sort, onSortChange)}
              </SortableColumn>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function renderHeaderCell(
  id: ColumnId,
  filters: Filters,
  onChange: (f: Filters) => void,
  members: Profile[],
  sort: SortState,
  onSortChange: (next: SortState) => void
): ReactNode {
  const sortDirection: "asc" | "desc" | null =
    sort && sort.column === id ? sort.direction : null;
  const handleSort = () => onSortChange(toggleSort(sort, id));

  switch (id) {
    case "publication":
      return (
        <ColumnHeader
          label={COLUMN_LABELS.publication}
          active={filters.publication !== null}
          sortDirection={sortDirection}
          onSortClick={handleSort}
        >
          <PublicationFilter
            selected={filters.publication}
            onChange={(next) => onChange({ ...filters, publication: next })}
          />
        </ColumnHeader>
      );
    case "assignee":
      return (
        <ColumnHeader
          label={COLUMN_LABELS.assignee}
          active={filters.assignee !== null}
          sortDirection={sortDirection}
          onSortClick={handleSort}
        >
          <MemberFilter
            members={members}
            allowUnassigned
            selected={filters.assignee}
            onChange={(next) => onChange({ ...filters, assignee: next })}
          />
        </ColumnHeader>
      );
    case "due":
      return (
        <ColumnHeader
          label={COLUMN_LABELS.due}
          active={filters.dueDate !== "all"}
          sortDirection={sortDirection}
          onSortClick={handleSort}
        >
          <DueDateFilter
            value={filters.dueDate}
            onChange={(next) => onChange({ ...filters, dueDate: next })}
          />
        </ColumnHeader>
      );
    case "createdBy":
      return (
        <ColumnHeader
          label={COLUMN_LABELS.createdBy}
          active={filters.createdBy !== null}
          sortDirection={sortDirection}
          onSortClick={handleSort}
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
      );
    case "priority":
      return (
        <ColumnHeader
          label={COLUMN_LABELS.priority}
          active={filters.priority !== null}
          sortDirection={sortDirection}
          onSortClick={handleSort}
        >
          <PriorityFilter
            selected={filters.priority}
            onChange={(next) => onChange({ ...filters, priority: next })}
          />
        </ColumnHeader>
      );
  }
}

// --- Sortable wrapper ------------------------------------------------

function SortableColumn({ id, children }: { id: ColumnId; children: ReactNode }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id });
  const widths = useColumnWidths();
  const width = effectiveColumnWidth(id, widths);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        width,
      }}
      className={cn(
        "shrink-0 px-2 flex items-stretch cursor-grab active:cursor-grabbing relative",
        isDragging && "opacity-60"
      )}
      {...attributes}
      {...listeners}
    >
      <ResizeHandle id={id} currentWidth={width} side="left" />
      {children}
      <ResizeHandle id={id} currentWidth={width} side="right" />
    </div>
  );
}

// --- Column resize handle --------------------------------------------
//
// Thin overlay on either edge of a header cell. Pointer events are
// stopped before they reach the SortableColumn so a resize drag never
// triggers a dnd-kit reorder. The left-side variant inverts the delta
// so dragging outward (left) widens the column the same way dragging
// the right handle outward (right) does.

function ResizeHandle({
  id,
  currentWidth,
  side,
}: {
  id: ColumnId;
  currentWidth: number;
  side: "left" | "right";
}) {
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startW = currentWidth;
    const min = COLUMN_MIN_WIDTHS[id];
    const sign = side === "right" ? 1 : -1;

    const onMove = (ev: PointerEvent) => {
      const next = Math.max(min, startW + (ev.clientX - startX) * sign);
      setColumnWidth(id, next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "absolute top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40 z-10",
        side === "right" ? "right-0 -mr-0.5" : "left-0 -ml-0.5"
      )}
      aria-hidden
    />
  );
}

// --- Reusable column header trigger ----------------------------------

function ColumnHeader({
  label,
  active,
  sortDirection,
  onSortClick,
  children,
}: {
  label: string;
  active: boolean;
  sortDirection: "asc" | "desc" | null;
  onSortClick: () => void;
  children: ReactNode;
}) {
  return (
    <Popover>
      <div className="w-full self-center flex items-center justify-between gap-0.5">
        <button
          type="button"
          onClick={onSortClick}
          className={cn(
            "min-w-0 flex-1 flex items-center gap-1 rounded px-1 py-0.5 text-left transition-colors hover:text-foreground hover:bg-accent",
            (active || sortDirection) && "text-foreground"
          )}
          aria-label={`Sort by ${label}`}
        >
          <span className="truncate">{label}</span>
          {sortDirection === "asc" && (
            <ArrowUp className="h-3 w-3 shrink-0" aria-hidden />
          )}
          {sortDirection === "desc" && (
            <ArrowDown className="h-3 w-3 shrink-0" aria-hidden />
          )}
        </button>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "shrink-0 flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-foreground hover:bg-accent",
              active && "text-foreground"
            )}
            aria-label={`Filter by ${label}`}
          >
            {active && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-primary"
                aria-hidden
              />
            )}
            <ChevronDown className="h-3 w-3" aria-hidden />
          </button>
        </PopoverTrigger>
      </div>
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

// --- Publication multi-select filter ---------------------------------

function PublicationFilter({
  selected,
  onChange,
}: {
  selected: Set<string | null> | null;
  onChange: (next: Set<string | null> | null) => void;
}) {
  const toggle = (slug: string | null) => {
    const next = new Set(selected ?? []);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
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
        Any publication
      </button>
      <div className="h-px bg-border my-1" />
      <div className="max-h-64 overflow-y-auto">
        <FilterRow
          label="No publication"
          checked={selected?.has(null) ?? false}
          onToggle={() => toggle(null)}
          leading={
            <span className="h-5 w-5 rounded bg-muted shrink-0" aria-hidden />
          }
        />
        {PUBLICATION_CATEGORIES.map((category) => {
          const items = PUBLICATIONS.filter((p) => p.category === category);
          if (items.length === 0) return null;
          return (
            <div key={category}>
              <div className="px-2 pt-2 pb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {category}
              </div>
              {items.map((p) => (
                <FilterRow
                  key={p.slug}
                  label={p.name}
                  checked={selected?.has(p.slug) ?? false}
                  onToggle={() => toggle(p.slug)}
                  leading={
                    <img
                      src={p.thumbnail}
                      alt=""
                      className="h-5 w-5 rounded object-cover shrink-0"
                    />
                  }
                />
              ))}
            </div>
          );
        })}
      </div>
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

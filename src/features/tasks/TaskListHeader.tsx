import { useRef, useState, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, Check } from "lucide-react";

import { IconChevronDown, IconColumnSettings } from "@/components/icons/figma";
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkspaceMembers } from "@/features/workspaces/useWorkspaceMembers";
import { cn } from "@/lib/utils";
import type { Profile, TaskPriority } from "@/types/database";

import { PRIORITIES } from "./priority";
import { groupItems, type CatalogProfile } from "./catalog";
import { useCatalog } from "./CatalogProvider";
import { BrandThumb } from "./BrandThumb";
import {
  COLUMN_LABELS,
  COLUMN_MIN_WIDTHS,
  NAME_MIN_WIDTH,
  effectiveColumnWidth,
  setColumnOrder,
  setColumnVisible,
  setColumnWidth,
  setNameWidth,
  toggleSort,
  useColumnOrder,
  useColumnWidths,
  useHiddenColumns,
  useNameWidth,
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
  const catalog = useCatalog();
  const order = useColumnOrder();
  const hidden = useHiddenColumns();
  // Only the columns the user has chosen to show — preserves the user's
  // drag-reorder among the visible ones. The full `order` still drives
  // the settings dropdown so hidden columns can be re-enabled.
  const visibleOrder = useMemo(
    () => order.filter((id) => !hidden.has(id)),
    [order, hidden]
  );

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

  const nameWidth = useNameWidth();

  return (
    <div className="shrink-0 flex items-stretch gap-2 pl-4 pr-4 py-2 bg-background text-xs font-medium text-[#708597] shadow-[0_2px_2px_rgba(0,0,0,0.06)]">
      {/* Checkbox spacer matches the row's 18px circle. Keeps "Name"
          pixel-aligned with the row's title text. */}
      <span className="w-[18px] shrink-0 self-center" aria-hidden />

      {/* Name is a fixed-width "column" — anchoring it (rather than
          letting flex-1 absorb leftover space) gives the columns block a
          stable left edge, which is what makes per-column resize feel
          right (each column's boundary follows the cursor instead of
          the whole block sliding). The handle on Name's right resizes
          Name; everything to its right shifts in lockstep. */}
      <div
        style={{ width: nameWidth }}
        className="shrink-0 relative self-stretch flex items-center"
      >
        <span className="self-center truncate">Name</span>
        <ResizeHandle
          currentWidth={nameWidth}
          min={NAME_MIN_WIDTH}
          onWidthChange={setNameWidth}
        />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleOrder}
          strategy={horizontalListSortingStrategy}
        >
          <div className="shrink-0 flex items-stretch -my-2">
            {visibleOrder.map((id) => (
              <SortableColumn key={id} id={id}>
                {renderHeaderCell(id, filters, onChange, members, sort, onSortChange, catalog)}
              </SortableColumn>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Settings dropdown — controls per-column visibility. Lives at
          the right edge of the header strip, outside the sortable
          context so its click never starts a column reorder. The full
          `order` (visible + hidden) is iterated so previously-hidden
          columns can be toggled back on. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Column settings"
            title="Show/hide columns"
            // ml-auto pushes the trigger to the far right of the header
            // strip — the SortableContext columns stay left-anchored next
            // to the Name column and the settings icon hugs the right
            // edge regardless of how many columns are visible.
            className="ml-auto self-center h-[18px] w-[18px] inline-flex items-center justify-center text-[#708597] hover:text-foreground rounded transition-colors"
          >
            <IconColumnSettings className="h-[18px] w-[18px]" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs font-semibold text-[#708597] normal-case">
            Show columns
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {order.map((id) => (
            <DropdownMenuCheckboxItem
              key={id}
              checked={!hidden.has(id)}
              onCheckedChange={(checked) => setColumnVisible(id, !!checked)}
              // Prevent the menu from closing on each toggle so the
              // user can flip several columns in one open.
              onSelect={(e) => e.preventDefault()}
            >
              {id === "publication" ? catalog.itemLabel : COLUMN_LABELS[id]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function renderHeaderCell(
  id: ColumnId,
  filters: Filters,
  onChange: (f: Filters) => void,
  members: Profile[],
  sort: SortState,
  onSortChange: (next: SortState) => void,
  catalog: CatalogProfile
): ReactNode {
  const sortDirection: "asc" | "desc" | null =
    sort && sort.column === id ? sort.direction : null;
  const handleSort = () => onSortChange(toggleSort(sort, id));

  switch (id) {
    case "publication":
      return (
        <ColumnHeader
          label={catalog.itemLabel}
          active={filters.publication !== null}
          sortDirection={sortDirection}
          onSortClick={handleSort}
        >
          <PublicationFilter
            profile={catalog}
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
    case "type":
      return (
        <ColumnHeader
          label={COLUMN_LABELS.type}
          active={filters.type !== null}
          sortDirection={sortDirection}
          onSortClick={handleSort}
        >
          <TypeFilter
            profile={catalog}
            selected={filters.type}
            onChange={(next) => onChange({ ...filters, type: next })}
          />
        </ColumnHeader>
      );
  }
}

// --- Task-type multi-select filter -----------------------------------

function TypeFilter({
  profile,
  selected,
  onChange,
}: {
  profile: CatalogProfile;
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
        Any type
      </button>
      <div className="h-px bg-border my-1" />
      <FilterRow
        label="No type"
        checked={selected?.has(null) ?? false}
        onToggle={() => toggle(null)}
      />
      {profile.taskTypes.map((t) => (
        <FilterRow
          key={t.slug}
          label={t.name}
          checked={selected?.has(t.slug) ?? false}
          onToggle={() => toggle(t.slug)}
        />
      ))}
    </div>
  );
}

// --- Sortable wrapper ------------------------------------------------

function SortableColumn({
  id,
  children,
}: {
  id: ColumnId;
  children: ReactNode;
}) {
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
      {children}
      {/* Single resize handle on this column's right edge. Resizes ONLY
          this column — columns to its right keep their widths and
          shift along by the same delta. Works because the Name column
          (rendered above) is fixed-width, so the columns block has a
          stable left edge that resize doesn't fight against. */}
      <ResizeHandle
        currentWidth={width}
        min={COLUMN_MIN_WIDTHS[id]}
        onWidthChange={(w) => setColumnWidth(id, w)}
      />
    </div>
  );
}

// --- Resize handle (reusable) ----------------------------------------
//
// Width-agnostic: takes the cell's current width, its min width, and a
// callback to apply the new width. Sits on the cell's right edge. The
// containing cell needs `position: relative` so the handle's `absolute
// right-0` lands on the right edge. Pointer events are stopped before
// reaching the SortableColumn so a resize drag never triggers a
// dnd-kit reorder.

function ResizeHandle({
  currentWidth,
  min,
  onWidthChange,
}: {
  currentWidth: number;
  min: number;
  onWidthChange: (next: number) => void;
}) {
  // Single source of truth for the ghost line's x position. Set on
  // pointer-enter (hover preview at the column edge), updated during
  // drag (follows the cursor, clamped to min-width), cleared on
  // pointer-leave or pointer-up. The `isDraggingRef` flag prevents a
  // pointer-leave triggered mid-drag from prematurely hiding the line.
  const [ghostX, setGhostX] = useState<number | null>(null);
  const isDraggingRef = useRef(false);

  const onPointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setGhostX(rect.left + rect.width / 2);
  };

  const onPointerLeave = () => {
    if (isDraggingRef.current) return;
    setGhostX(null);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startW = currentWidth;
    isDraggingRef.current = true;
    setGhostX(e.clientX);

    const onMove = (ev: PointerEvent) => {
      // Allowed delta: never below `min - startW` (so width never drops
      // under its minimum). Drag-right is unbounded; the cell just keeps
      // widening — the columns container is left-anchored so this is
      // safe (everything to the right shifts right with it).
      const minDelta = min - startW;
      const requested = ev.clientX - startX;
      const delta = Math.max(minDelta, requested);

      onWidthChange(startW + delta);
      setGhostX(startX + delta);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      isDraggingRef.current = false;
      setGhostX(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <>
      <div
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-0 bottom-0 right-0 -mr-0.5 w-1.5 cursor-col-resize hover:bg-primary/40 z-10"
        aria-hidden
      />
      {ghostX !== null &&
        createPortal(
          // Fixed-position ghost line; `pointer-events-none` so it can't
          // intercept the pointer-up the parent is listening for.
          <div
            aria-hidden
            style={{ left: ghostX }}
            className="fixed top-0 bottom-0 z-50 w-px bg-[#DEDFE0] pointer-events-none"
          />,
          document.body
        )}
    </>
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
            <IconChevronDown className="h-4 w-4 text-[#708597]" />
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
  profile,
  selected,
  onChange,
}: {
  profile: CatalogProfile;
  selected: Set<string | null> | null;
  onChange: (next: Set<string | null> | null) => void;
}) {
  const label = profile.itemLabel.toLowerCase();
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
        Any {label}
      </button>
      <div className="h-px bg-border my-1" />
      <div className="max-h-64 overflow-y-auto">
        <FilterRow
          label={`No ${label}`}
          checked={selected?.has(null) ?? false}
          onToggle={() => toggle(null)}
          leading={
            <span className="h-5 w-5 rounded bg-muted shrink-0" aria-hidden />
          }
        />
        {groupItems(profile, profile.items).map((group, gi) => (
          <div key={group.category ?? `g${gi}`}>
            {group.category !== null && (
              <div className="px-2 pt-2 pb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {group.category}
              </div>
            )}
            {group.items.map((p) => (
              <FilterRow
                key={p.slug}
                label={p.name}
                checked={selected?.has(p.slug) ?? false}
                onToggle={() => toggle(p.slug)}
                leading={
                  <BrandThumb thumbnail={p.thumbnail} className="h-5 w-5 rounded" />
                }
              />
            ))}
          </div>
        ))}
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

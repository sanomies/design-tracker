import { useSyncExternalStore } from "react";

// Registry of all draggable columns in the task list view. The order the
// user drags into is persisted to localStorage and shared by both the
// header (where dragging happens) and TaskRow (which mirrors the order).

export type ColumnId =
  | "publication"
  | "assignee"
  | "due"
  | "createdBy"
  | "priority"
  | "type";

export const DEFAULT_COLUMN_ORDER: ColumnId[] = [
  "publication",
  "assignee",
  "due",
  "createdBy",
  "priority",
  "type",
];

export const COLUMN_LABELS: Record<ColumnId, string> = {
  // The internal column id stays "publication" so the DB column and any
  // stored column-order localStorage entries keep working untouched —
  // the user-facing label just renames to "Brand" to match the latest
  // Figma + detail-panel field name.
  publication: "Brand",
  assignee: "Assignee",
  due: "Due date",
  createdBy: "Created by",
  priority: "Priority",
  type: "Type",
};

export type SortDirection = "asc" | "desc";
export type SortState = { column: ColumnId; direction: SortDirection } | null;

// Click cycle on a column label: nothing → asc → desc → nothing. Clicking
// a different column always resets to asc on that column.
export function toggleSort(current: SortState, column: ColumnId): SortState {
  if (!current || current.column !== column) return { column, direction: "asc" };
  if (current.direction === "asc") return { column, direction: "desc" };
  return null;
}

// Minimum pixel width per column — chosen so the header label + chevron +
// active-filter dot fit without truncation. The user can drag any column
// wider than this; they cannot drag below.
export const COLUMN_MIN_WIDTHS: Record<ColumnId, number> = {
  publication: 130,
  assignee: 110,
  due: 95,
  createdBy: 120,
  priority: 95,
  type: 105,
};

// --- Persisted column order ------------------------------------------

const STORAGE_KEY = "design-tracker:task-column-order";

function readOrder(): ColumnId[] {
  if (typeof window === "undefined") return DEFAULT_COLUMN_ORDER;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMN_ORDER;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_COLUMN_ORDER;
    const valid = parsed.filter((id): id is ColumnId =>
      (DEFAULT_COLUMN_ORDER as readonly string[]).includes(id as string)
    );
    // Append any columns missing from the stored order (e.g. newly added)
    // so a stale localStorage entry still surfaces them.
    const missing = DEFAULT_COLUMN_ORDER.filter((id) => !valid.includes(id));
    return [...valid, ...missing];
  } catch {
    return DEFAULT_COLUMN_ORDER;
  }
}

let cached: ColumnId[] = readOrder();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function setColumnOrder(next: ColumnId[]) {
  // Skip notify if the order didn't actually change (referential equality
  // is enforced by `cached` swap).
  if (
    next.length === cached.length &&
    next.every((id, i) => id === cached[i])
  ) {
    return;
  }
  cached = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
  notify();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// Hook returning the current (possibly user-reordered) column list. Any
// component using it re-renders when the order changes.
export function useColumnOrder(): ColumnId[] {
  return useSyncExternalStore(
    subscribe,
    () => cached,
    () => cached
  );
}

// --- Persisted column widths -----------------------------------------
//
// A column without an entry here renders at COLUMN_MIN_WIDTHS[id]. Drag
// the resize handle on a header cell to set a wider value; widths below
// the minimum are clamped on read so a stale localStorage entry can't
// produce an unusable column.

const WIDTH_STORAGE_KEY = "design-tracker:task-column-widths";

type WidthMap = Partial<Record<ColumnId, number>>;

function readWidths(): WidthMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(WIDTH_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: WidthMap = {};
    for (const id of DEFAULT_COLUMN_ORDER) {
      const v = (parsed as Record<string, unknown>)[id];
      if (typeof v === "number" && Number.isFinite(v) && v > 0) {
        out[id] = Math.max(COLUMN_MIN_WIDTHS[id], Math.round(v));
      }
    }
    return out;
  } catch {
    return {};
  }
}

let cachedWidths: WidthMap = readWidths();
const widthListeners = new Set<() => void>();

function notifyWidths() {
  for (const l of widthListeners) l();
}

export function setColumnWidth(id: ColumnId, width: number | null) {
  const next: WidthMap = { ...cachedWidths };
  if (width === null) {
    delete next[id];
  } else {
    next[id] = Math.max(COLUMN_MIN_WIDTHS[id], Math.round(width));
  }
  // Skip writes that change nothing — keeps useSyncExternalStore quiet
  // and avoids needless localStorage churn during a resize drag.
  if (next[id] === cachedWidths[id]) return;
  cachedWidths = next;
  try {
    localStorage.setItem(WIDTH_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
  notifyWidths();
}

function subscribeWidths(cb: () => void) {
  widthListeners.add(cb);
  return () => {
    widthListeners.delete(cb);
  };
}

export function useColumnWidths(): WidthMap {
  return useSyncExternalStore(
    subscribeWidths,
    () => cachedWidths,
    () => cachedWidths
  );
}

export function effectiveColumnWidth(id: ColumnId, widths: WidthMap): number {
  return widths[id] ?? COLUMN_MIN_WIDTHS[id];
}

// --- Persisted Name (title) column width -----------------------------
//
// The Name column is special: it isn't sortable or drag-reorderable and
// doesn't participate in the ColumnId-keyed widths above, but it IS
// resizable. Giving it an explicit width (rather than `flex-1`) anchors
// the rest of the columns block to a fixed left edge, which is what
// lets per-column resize work the way users expect — each column's
// boundary follows the cursor instead of the whole block sliding around.

export const NAME_MIN_WIDTH = 200;
export const DEFAULT_NAME_WIDTH = 480;
const NAME_WIDTH_STORAGE_KEY = "design-tracker:task-name-column-width";

function readNameWidth(): number {
  if (typeof window === "undefined") return DEFAULT_NAME_WIDTH;
  try {
    const raw = localStorage.getItem(NAME_WIDTH_STORAGE_KEY);
    if (!raw) return DEFAULT_NAME_WIDTH;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === "number" && Number.isFinite(parsed) && parsed > 0) {
      return Math.max(NAME_MIN_WIDTH, Math.round(parsed));
    }
    return DEFAULT_NAME_WIDTH;
  } catch {
    return DEFAULT_NAME_WIDTH;
  }
}

let cachedNameWidth = readNameWidth();
const nameWidthListeners = new Set<() => void>();

export function setNameWidth(width: number) {
  const clamped = Math.max(NAME_MIN_WIDTH, Math.round(width));
  if (clamped === cachedNameWidth) return;
  cachedNameWidth = clamped;
  try {
    localStorage.setItem(NAME_WIDTH_STORAGE_KEY, JSON.stringify(clamped));
  } catch {
    // ignore quota / private mode
  }
  for (const l of nameWidthListeners) l();
}

function subscribeNameWidth(cb: () => void) {
  nameWidthListeners.add(cb);
  return () => {
    nameWidthListeners.delete(cb);
  };
}

export function useNameWidth(): number {
  return useSyncExternalStore(
    subscribeNameWidth,
    () => cachedNameWidth,
    () => cachedNameWidth
  );
}

// --- Persisted column visibility -------------------------------------
//
// Lets the user hide/show metadata columns from the task list view via
// the settings dropdown at the end of the column header. Default = all
// columns visible. Stored as the set of HIDDEN column ids so newly-
// added columns automatically appear without a storage migration.

const VISIBILITY_STORAGE_KEY = "design-tracker:task-column-hidden";

function readHidden(): Set<ColumnId> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(VISIBILITY_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((id): id is ColumnId =>
        (DEFAULT_COLUMN_ORDER as readonly string[]).includes(id as string)
      )
    );
  } catch {
    return new Set();
  }
}

let cachedHidden: Set<ColumnId> = readHidden();
const hiddenListeners = new Set<() => void>();

function notifyHidden() {
  for (const l of hiddenListeners) l();
}

export function setColumnVisible(id: ColumnId, visible: boolean) {
  const next = new Set(cachedHidden);
  if (visible) next.delete(id);
  else next.add(id);
  if (next.size === cachedHidden.size && [...next].every((x) => cachedHidden.has(x))) {
    return;
  }
  cachedHidden = next;
  try {
    localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    // ignore quota / private mode
  }
  notifyHidden();
}

function subscribeHidden(cb: () => void) {
  hiddenListeners.add(cb);
  return () => {
    hiddenListeners.delete(cb);
  };
}

/** Returns the set of HIDDEN column ids. Components typically want to
 *  filter `useColumnOrder()` by this set rather than read it directly. */
export function useHiddenColumns(): Set<ColumnId> {
  return useSyncExternalStore(
    subscribeHidden,
    () => cachedHidden,
    () => cachedHidden
  );
}

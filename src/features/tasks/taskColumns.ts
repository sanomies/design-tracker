import { useSyncExternalStore } from "react";

// Registry of all draggable columns in the task list view. The order the
// user drags into is persisted to localStorage and shared by both the
// header (where dragging happens) and TaskRow (which mirrors the order).

export type ColumnId =
  | "publication"
  | "assignee"
  | "due"
  | "createdBy"
  | "priority";

export const DEFAULT_COLUMN_ORDER: ColumnId[] = [
  "publication",
  "assignee",
  "due",
  "createdBy",
  "priority",
];

export const COLUMN_LABELS: Record<ColumnId, string> = {
  publication: "Publication",
  assignee: "Assignee",
  due: "Due date",
  createdBy: "Created by",
  priority: "Priority",
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

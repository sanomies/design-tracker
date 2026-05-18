import type { Profile, Task } from "@/types/database";

import { PUBLICATIONS } from "./publications";
import type { SortState } from "./taskColumns";

// Build a comparator from the active sort state. Returns null when no
// sort is set — caller falls back to position-based ordering. Nulls /
// empty values always sort to the bottom regardless of direction so the
// user always sees populated rows first.
export function buildSortComparator(
  sort: SortState,
  members: Profile[]
): ((a: Task, b: Task) => number) | null {
  if (!sort) return null;
  const { column, direction } = sort;
  const dir = direction === "asc" ? 1 : -1;

  const memberName = new Map<string, string>();
  for (const m of members) {
    memberName.set(m.id, (m.full_name ?? "").toLowerCase());
  }
  const pubIndex = new Map<string, number>();
  PUBLICATIONS.forEach((p, i) => pubIndex.set(p.slug, i));

  switch (column) {
    case "assignee":
      return (a, b) =>
        compareNullable(
          a.assignee_id ? memberName.get(a.assignee_id) ?? "" : null,
          b.assignee_id ? memberName.get(b.assignee_id) ?? "" : null,
          (x, y) => x.localeCompare(y),
          dir
        );
    case "createdBy":
      return (a, b) =>
        compareNullable(
          a.created_by ? memberName.get(a.created_by) ?? "" : null,
          b.created_by ? memberName.get(b.created_by) ?? "" : null,
          (x, y) => x.localeCompare(y),
          dir
        );
    case "due":
      // ISO dates compare lexicographically.
      return (a, b) =>
        compareNullable(
          a.due_date,
          b.due_date,
          (x, y) => x.localeCompare(y),
          dir
        );
    case "priority":
      return (a, b) =>
        compareNullable(
          priorityRank(a.priority),
          priorityRank(b.priority),
          (x, y) => x - y,
          dir
        );
    case "publication":
      return (a, b) =>
        compareNullable(
          a.publication ? pubIndex.get(a.publication) ?? 0 : null,
          b.publication ? pubIndex.get(b.publication) ?? 0 : null,
          (x, y) => x - y,
          dir
        );
  }
}

// Null is always treated as "greater" so it sinks to the bottom in both
// asc and desc orderings; `dir` only flips the order of populated values.
function compareNullable<T>(
  a: T | null,
  b: T | null,
  cmp: (x: T, y: T) => number,
  dir: 1 | -1
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return dir * cmp(a, b);
}

const PRIORITY_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };
function priorityRank(p: string | null | undefined): number | null {
  if (!p) return null;
  return PRIORITY_RANK[p] ?? null;
}

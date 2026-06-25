// A project's "kind" selects a catalog profile: which brand/product items
// the picker offers, how they're grouped, what the field is called in the
// UI ("Brand" vs "Product"), and which task-type set applies. Everything
// downstream (picker, row cells, column header, filters, sort) reads the
// active profile rather than importing a single global catalog, so the same
// components serve both kinds — and cross-project views (My tasks) resolve
// each row from its own project's profile.

import {
  PUBLICATIONS,
  PUBLICATION_CATEGORIES,
  type Publication,
} from "./publications";
import { PRODUCTS, PRODUCT_CATEGORY } from "./products";
import {
  MARKETING_TASK_TYPES,
  PRODUCT_TASK_TYPES,
  type TaskTypeEntry,
} from "./taskTypes";

export type ProjectKind = "marketing" | "product";

export type CatalogProfile = {
  /** Singular UI label for the brand/product field: "Brand" | "Product". */
  itemLabel: string;
  items: Publication[];
  /** Group order. <= 1 entry => the picker renders a flat list (no headers). */
  categories: string[];
  taskTypes: TaskTypeEntry[];
};

export const MARKETING_PROFILE: CatalogProfile = {
  itemLabel: "Brand",
  items: PUBLICATIONS,
  categories: PUBLICATION_CATEGORIES,
  taskTypes: MARKETING_TASK_TYPES,
};

export const PRODUCT_PROFILE: CatalogProfile = {
  itemLabel: "Product",
  items: PRODUCTS,
  // Single category => flat list in the picker; the label still groups
  // products in the merged My-tasks filter.
  categories: [PRODUCT_CATEGORY],
  taskTypes: PRODUCT_TASK_TYPES,
};

export function getProfile(kind: string | null | undefined): CatalogProfile {
  return kind === "product" ? PRODUCT_PROFILE : MARKETING_PROFILE;
}

function dedupeItems(items: Publication[]): Publication[] {
  const seen = new Set<string>();
  const out: Publication[] = [];
  for (const it of items) {
    if (seen.has(it.slug)) continue;
    seen.add(it.slug);
    out.push(it);
  }
  return out;
}

function dedupeTypes(types: TaskTypeEntry[]): TaskTypeEntry[] {
  const seen = new Set<string>();
  const out: TaskTypeEntry[] = [];
  for (const t of types) {
    if (seen.has(t.slug)) continue;
    seen.add(t.slug);
    out.push(t);
  }
  return out;
}

// Union of all kinds, for the cross-project "My tasks" view where rows come
// from projects of either kind. Used only for that view's column header,
// filters and sort index — each row's icon/label still resolves from its
// own project's profile. On a slug collision (e.g. "delfi" exists in both),
// the brand entry wins; this only affects which icon a filter row shows,
// never a task row.
export const MERGED_PROFILE: CatalogProfile = {
  itemLabel: "Brand",
  items: dedupeItems([...PUBLICATIONS, ...PRODUCTS]),
  categories: [...PUBLICATION_CATEGORIES, PRODUCT_CATEGORY],
  taskTypes: dedupeTypes([...MARKETING_TASK_TYPES, ...PRODUCT_TASK_TYPES]),
};

export function catalogItem(
  profile: CatalogProfile,
  slug: string | null | undefined
): Publication | undefined {
  if (!slug) return undefined;
  return profile.items.find((p) => p.slug === slug);
}

export function catalogType(
  profile: CatalogProfile,
  slug: string | null | undefined
): TaskTypeEntry | null {
  if (!slug) return null;
  return profile.taskTypes.find((t) => t.slug === slug) ?? null;
}

// Display-ordered groups for the picker. With >1 category, yields one group
// per non-empty category in profile order (plus any uncategorised items as
// a trailing untitled group); otherwise a single untitled group. A null
// `category` means "render no header".
export function groupItems(
  profile: CatalogProfile,
  items: Publication[]
): { category: string | null; items: Publication[] }[] {
  if (profile.categories.length <= 1) {
    return items.length ? [{ category: null, items }] : [];
  }
  const groups: { category: string | null; items: Publication[] }[] = [];
  for (const category of profile.categories) {
    const inCat = items.filter((p) => p.category === category);
    if (inCat.length) groups.push({ category, items: inCat });
  }
  const listed = new Set(profile.categories);
  const orphans = items.filter((p) => !listed.has(p.category));
  if (orphans.length) groups.push({ category: null, items: orphans });
  return groups;
}

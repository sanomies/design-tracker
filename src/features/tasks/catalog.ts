// A project's "kind" selects a catalog profile: which brand/product/client
// items the picker offers, how they're grouped, what the field is called in
// the UI ("Brand" / "Product" / "Klient"), and which task-type set applies.
// Everything downstream (picker, row cells, column header, filters, sort)
// reads the active profile rather than importing a single global catalog, so
// the same components serve every kind — and cross-project views (My tasks)
// resolve each row from its own project's profile.

import {
  PUBLICATIONS,
  PUBLICATION_CATEGORIES,
  BRAND_THUMBNAILS,
  type Publication,
} from "./publications";
import { PRODUCTS, PRODUCT_CATEGORY } from "./products";
import { CLIENTS, CLIENT_CATEGORY } from "./clients";
import {
  MARKETING_TASK_TYPES,
  PRODUCT_TASK_TYPES,
  REKLAAM_TASK_TYPES,
  EVENTS_TASK_TYPES,
  EDITORIAL_TASK_TYPES,
  type TaskTypeEntry,
} from "./taskTypes";

export type ProjectKind =
  | "marketing"
  | "product"
  | "reklaam"
  | "events"
  | "editorial";

export type CatalogProfile = {
  /** Singular UI label for the item field: "Brand" | "Product" | "Klient". */
  itemLabel: string;
  /** Plural form for "Filter …" / "No … match"; defaults to itemLabel + "s". */
  itemLabelPlural?: string;
  items: Publication[];
  /** Group order. <= 1 entry => the picker renders a flat list (no headers). */
  categories: string[];
  taskTypes: TaskTypeEntry[];
};

/** Plural label for a profile (Estonian labels carry their own plural). */
export function pluralLabel(profile: CatalogProfile): string {
  return profile.itemLabelPlural ?? `${profile.itemLabel}s`;
}

// Events / editorial reuse the Delfi brand SVGs (by slug) with a curated
// subset and their own display names. `brand()` looks the icon up by slug.
function brand(slug: string, name: string): Publication {
  return { slug, name, category: "Brand", thumbnail: BRAND_THUMBNAILS[slug] };
}

const EVENTS_BRANDS: Publication[] = [
  brand("delfi", "Delfi"),
  brand("kroonika", "Kroonika"),
  brand("arileht", "Ärileht"),
  brand("arvamus", "Arvamus"),
  brand("delfitv", "Delfi TV"),
  brand("omamaitse", "Oma Maitse"),
  brand("maakodu", "Maakodu"),
  brand("ilmateade", "Ilmateade"),
  brand("lood", "Delfi Lood"),
  brand("delfisport", "Sport"),
  brand("kultuur", "Kultuur"),
  brand("rusdelfi", "RusDelfi"),
  brand("tasku", "Delfi Tasku"),
  brand("forte", "Forte"),
  brand("lp", "LP"),
  brand("eestinaine", "Eesti Naine"),
  brand("perejakodu", "Pere ja Kodu"),
  brand("annestiil", "Anne & Stiil"),
  brand("tervispluss", "Tervis Pluss"),
  brand("moodnekodu", "Moodne Kodu"),
  brand("eestiekspress", "Eesti Ekspress"),
  brand("maaleht", "Maaleht"),
  brand("geenius", "Geenius"),
  brand("ekkk", "EKKK"),
  brand("piletitasku", "Piletitasku"),
];

// Editorial = the same set minus EKKK and Piletitasku.
const EDITORIAL_BRANDS: Publication[] = EVENTS_BRANDS.filter(
  (b) => b.slug !== "ekkk" && b.slug !== "piletitasku"
);

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

export const REKLAAM_PROFILE: CatalogProfile = {
  itemLabel: "Klient",
  itemLabelPlural: "Kliendid",
  items: CLIENTS,
  categories: [],
  taskTypes: REKLAAM_TASK_TYPES,
};

export const EVENTS_PROFILE: CatalogProfile = {
  itemLabel: "Brand",
  items: EVENTS_BRANDS,
  categories: [],
  taskTypes: EVENTS_TASK_TYPES,
};

export const EDITORIAL_PROFILE: CatalogProfile = {
  itemLabel: "Brand",
  items: EDITORIAL_BRANDS,
  categories: [],
  taskTypes: EDITORIAL_TASK_TYPES,
};

export function getProfile(kind: string | null | undefined): CatalogProfile {
  switch (kind) {
    case "product":
      return PRODUCT_PROFILE;
    case "reklaam":
      return REKLAAM_PROFILE;
    case "events":
      return EVENTS_PROFILE;
    case "editorial":
      return EDITORIAL_PROFILE;
    default:
      return MARKETING_PROFILE;
  }
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
// from projects of any kind. Used only for that view's column header,
// filters and sort index — each row's icon/label still resolves from its own
// project's profile. Events/editorial reuse brand slugs already in
// PUBLICATIONS, so only PRODUCTS + CLIENTS add new items here. On a slug
// collision the brand entry wins; that only affects which icon a filter row
// shows, never a task row.
export const MERGED_PROFILE: CatalogProfile = {
  itemLabel: "Brand",
  items: dedupeItems([...PUBLICATIONS, ...PRODUCTS, ...CLIENTS]),
  categories: [...PUBLICATION_CATEGORIES, PRODUCT_CATEGORY, CLIENT_CATEGORY],
  taskTypes: dedupeTypes([
    ...MARKETING_TASK_TYPES,
    ...PRODUCT_TASK_TYPES,
    ...REKLAAM_TASK_TYPES,
    ...EVENTS_TASK_TYPES,
    ...EDITORIAL_TASK_TYPES,
  ]),
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

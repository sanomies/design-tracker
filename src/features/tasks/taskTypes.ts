// Catalog of task `type` values, one set per project kind. The DB column
// is plain text so editing these lists lights up everywhere it's referenced
// without a migration. Slugs are ASCII-safe (Estonian diacritics folded)
// and stable — display names can change without touching stored data. The
// active set is selected per project from its kind (see catalog.ts).

export type TaskTypeEntry = {
  slug: string;
  name: string;
};

// `marketing` projects (e.g. Turundus).
export const MARKETING_TASK_TYPES: TaskTypeEntry[] = [
  { slug: "kampaania",      name: "Kampaania" },
  { slug: "pusiturundus",   name: "Püsiturundus (korduv)" },
  { slug: "brandimaterjal", name: "Brändimaterjal" },
  { slug: "tookuulutus",    name: "Töökuulutus" },
];

// `product` projects (e.g. Tootedisain).
export const PRODUCT_TASK_TYPES: TaskTypeEntry[] = [
  { slug: "uus-funktsioon",     name: "Uus funktsioon" },
  { slug: "parendus",           name: "Parendus" },
  { slug: "ui-komponent",       name: "UI komponent" },
  { slug: "disainisusteem",     name: "Disainisüsteem" },
  { slug: "embed-integratsioon", name: "Embed / integratsioon" },
];

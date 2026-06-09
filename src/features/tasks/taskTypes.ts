// Catalog of task `type` values. v1 ships with three presets; the DB
// column is plain text so adding a fourth here lights up everywhere it's
// referenced without a migration.

export type TaskTypeEntry = {
  slug: string;
  name: string;
};

export const TASK_TYPES: TaskTypeEntry[] = [
  { slug: "kampaania", name: "Kampaania" },
  { slug: "merch",     name: "Merch" },
  { slug: "outdoor",   name: "Outdoor" },
];

export function getTaskType(slug: string | null | undefined): TaskTypeEntry | null {
  if (!slug) return null;
  return TASK_TYPES.find((t) => t.slug === slug) ?? null;
}

// Project palette. The DB column is free-form text. Historically we
// stored named keys ("pink", "red", …) and resolved each to a Tailwind
// utility at render time. The Edit Project dialog now lets users pick
// any colour, so the column also holds raw hex strings going forward
// ("#FF99CC"). Both shapes are supported by the helpers below for
// backwards compat — existing rows don't need a migration.

export type ProjectColor =
  | "pink"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "cyan"
  | "blue"
  | "indigo"
  | "purple"
  | "slate";

// Quick-pick swatches shown above the freeform colour picker. The
// original six are preserved (existing rows reference them by name);
// the rest are added for broader coverage. Hex values picked to feel
// in-family with the originals — punchy / saturated.
export const PROJECT_COLORS: {
  value: ProjectColor;
  label: string;
  hex: string;
}[] = [
  { value: "pink",   label: "Pink",   hex: "#EC4899" },
  { value: "red",    label: "Red",    hex: "#EF4444" },
  { value: "orange", label: "Orange", hex: "#F97316" },
  { value: "yellow", label: "Yellow", hex: "#FACC15" },
  { value: "green",  label: "Green",  hex: "#10B981" },
  { value: "teal",   label: "Teal",   hex: "#14B8A6" },
  { value: "cyan",   label: "Cyan",   hex: "#06B6D4" },
  { value: "blue",   label: "Blue",   hex: "#3B82F6" },
  { value: "indigo", label: "Indigo", hex: "#6366F1" },
  { value: "purple", label: "Purple", hex: "#A855F7" },
  { value: "slate",  label: "Slate",  hex: "#64748B" },
];

export const DEFAULT_PROJECT_COLOR_HEX = "#14B8A6"; // teal
export const FALLBACK_PROJECT_COLOR_HEX = "#94A3B8"; // slate-400

const NAME_TO_HEX: Record<string, string> = Object.fromEntries(
  PROJECT_COLORS.map((c) => [c.value, c.hex])
);

/**
 * Resolve any stored project colour value to a CSS hex string.
 * Accepts:
 *   - Named keys: "pink", "red", …  → mapped from the table above
 *   - Hex strings: "#FF99CC" / "FF99CC" → returned normalised with "#"
 *   - null / undefined / unrecognised → FALLBACK_PROJECT_COLOR_HEX
 */
export function resolveProjectColor(color: string | null | undefined): string {
  if (!color) return FALLBACK_PROJECT_COLOR_HEX;
  const trimmed = color.trim();
  if (!trimmed) return FALLBACK_PROJECT_COLOR_HEX;
  if (NAME_TO_HEX[trimmed]) return NAME_TO_HEX[trimmed];
  // Bare hex shape — normalise to "#RRGGBB" / "#RGB". The regex is
  // intentionally forgiving; render code never trusts arbitrary strings
  // anyway because the value lands in `style={{backgroundColor}}`.
  if (/^#?[0-9a-fA-F]{3,8}$/.test(trimmed)) {
    return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  }
  return FALLBACK_PROJECT_COLOR_HEX;
}

/**
 * Single-letter initial used inside the colored pill that fronts each
 * project. Falls back to "?" so the pill always renders something.
 */
export function projectInitial(name: string | undefined | null): string {
  const trimmed = name?.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

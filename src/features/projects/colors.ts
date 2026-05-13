// Project palette. The DB column is free-form text; we store the `value`
// and resolve to a Tailwind class on render. Unknown values fall back to slate.

export type ProjectColor = "pink" | "red" | "orange" | "yellow" | "green" | "teal";

export const PROJECT_COLORS: { value: ProjectColor; label: string; className: string }[] = [
  { value: "pink", label: "Pink", className: "bg-pink-500" },
  { value: "red", label: "Red", className: "bg-red-500" },
  { value: "orange", label: "Orange", className: "bg-orange-500" },
  { value: "yellow", label: "Yellow", className: "bg-yellow-400" },
  { value: "green", label: "Green", className: "bg-emerald-500" },
  { value: "teal", label: "Teal", className: "bg-teal-500" },
];

export const DEFAULT_PROJECT_COLOR: ProjectColor = "teal";

export function projectColorClass(color: string | undefined | null): string {
  return PROJECT_COLORS.find((c) => c.value === color)?.className ?? "bg-slate-400";
}

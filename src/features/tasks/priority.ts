import type { TaskPriority } from "@/types/database";

export const PRIORITIES: { value: TaskPriority; label: string; className: string }[] = [
  { value: "low", label: "Low", className: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "medium", label: "Medium", className: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "high", label: "High", className: "bg-rose-100 text-rose-800 border-rose-200" },
];

export function priorityMeta(priority: TaskPriority | null | undefined) {
  return PRIORITIES.find((p) => p.value === priority);
}

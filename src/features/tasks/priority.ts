import type { TaskPriority } from "@/types/database";

export const PRIORITIES: { value: TaskPriority; label: string; className: string }[] = [
  {
    value: "low",
    label: "Low",
    className: "bg-[#EDF2F4] text-foreground border-transparent",
  },
  {
    value: "medium",
    label: "Medium",
    className: "bg-[#FFE500] text-black border-transparent",
  },
  {
    value: "high",
    label: "High",
    className: "bg-[#FF2B3A] text-white border-transparent",
  },
];

export function priorityMeta(priority: TaskPriority | null | undefined) {
  return PRIORITIES.find((p) => p.value === priority);
}

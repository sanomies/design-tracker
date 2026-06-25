import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/database";

type Kind = Project["kind"];

const OPTIONS: { value: Kind; label: string }[] = [
  { value: "marketing", label: "Brand" },
  { value: "product", label: "Product" },
];

/**
 * Segmented Brand/Product picker for a project's `kind`. A project's kind
 * selects which catalog its tasks use — "Brand" (marketing) tags tasks with
 * publications, "Product" tags them with products — and renames the picker
 * field accordingly. Shared by the New and Edit project dialogs.
 */
export function ProjectKindField({
  value,
  onChange,
}: {
  value: Kind;
  onChange: (kind: Kind) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>Project type</Label>
      <div className="flex gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 rounded-md border px-3 py-2 text-sm transition-colors",
              value === opt.value
                ? "border-primary bg-primary/5 font-medium text-foreground"
                : "border-input text-muted-foreground hover:bg-accent"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Decides whether tasks are tagged with brands or products.
      </p>
    </div>
  );
}

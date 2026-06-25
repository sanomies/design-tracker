import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Project } from "@/types/database";

type Kind = Project["kind"];

// Each kind keys a catalog profile (see features/tasks/catalog.ts). Labelled
// by the canonical project so the choice reads as "this is a Reklaam-type
// project". The profile decides the item field's name (Brand / Product /
// Klient), its item list, and the task types.
const OPTIONS: { value: Kind; label: string }[] = [
  { value: "marketing", label: "Turundus (Brand)" },
  { value: "product", label: "Tootedisain (Product)" },
  { value: "reklaam", label: "Reklaam (Klient)" },
  { value: "events", label: "Üritused (Brand)" },
  { value: "editorial", label: "Toimetuse projektid (Brand)" },
];

/**
 * Project-type picker for a project's `kind`. Shared by the New and Edit
 * project dialogs.
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
      <Select value={value} onValueChange={(v) => onChange(v as Kind)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Sets which brands/clients and task types this project uses.
      </p>
    </div>
  );
}

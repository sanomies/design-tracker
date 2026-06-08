import { useEffect, useId, useState } from "react";
import { HexColorPicker } from "react-colorful";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Hex colour picker built on `react-colorful` (3kb, zero deps). Designed
 * to feel like the shadcn-flavoured colour pickers in the wild:
 *   - Saturation/value canvas with the hue slider beneath
 *   - A hex input synced to the canvas (both directions)
 *   - Optional preset swatches above for quick selection
 *
 * The value is always a normalised "#RRGGBB" string; the parent owns the
 * value via the standard `value` / `onChange` props.
 */
export function ColorPicker({
  value,
  onChange,
  presets,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Optional palette of quick-pick swatches. */
  presets?: { value: string; label: string }[];
  className?: string;
}) {
  // Mirror the prop in a local `text` state so the user can type a draft
  // hex without us clobbering their input on every keystroke. Sync the
  // local draft back to the prop whenever it becomes a valid 7-char hex.
  const [text, setText] = useState(value);
  useEffect(() => {
    setText(value);
  }, [value]);

  const inputId = useId();

  const onHexInput = (raw: string) => {
    // Tolerate input without the leading "#" — auto-add it for the picker.
    const next = raw.startsWith("#") ? raw : `#${raw}`;
    setText(next);
    if (/^#[0-9a-fA-F]{6}$/.test(next)) {
      onChange(next.toUpperCase());
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => {
            const active = value.toLowerCase() === p.value.toLowerCase();
            return (
              <button
                key={p.value}
                type="button"
                aria-label={p.label}
                aria-pressed={active}
                onClick={() => onChange(p.value.toUpperCase())}
                className={cn(
                  "h-6 w-6 rounded-full transition",
                  active
                    ? "ring-2 ring-offset-2 ring-foreground"
                    : "hover:scale-110"
                )}
                style={{ backgroundColor: p.value }}
              />
            );
          })}
        </div>
      )}

      {/* react-colorful renders the canvas + hue slider; we leave it
          at its default size and constrain via CSS so it fits inside a
          ~400px dialog. */}
      <div className="[&_.react-colorful]:w-full [&_.react-colorful]:h-[160px] [&_.react-colorful__saturation]:rounded-md [&_.react-colorful__hue]:rounded-md [&_.react-colorful__hue]:mt-2">
        <HexColorPicker color={value} onChange={(c) => onChange(c.toUpperCase())} />
      </div>

      <div className="flex items-center gap-2">
        <span
          className="h-8 w-8 rounded-md border border-[#DEDFE0] shrink-0"
          style={{ backgroundColor: value }}
          aria-hidden
        />
        <Label htmlFor={inputId} className="sr-only">
          Hex colour
        </Label>
        <Input
          id={inputId}
          value={text}
          onChange={(e) => onHexInput(e.target.value)}
          placeholder="#000000"
          spellCheck={false}
          autoComplete="off"
          className="font-mono uppercase"
          maxLength={7}
        />
      </div>
    </div>
  );
}

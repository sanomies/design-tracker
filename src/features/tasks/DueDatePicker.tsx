import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Popover content for picking a due date. Callers wrap with their own
 * Popover so the trigger can be a button (detail panel) or just inline
 * text (task row).
 */
export function DueDatePickerContent({
  value,
  onChange,
  onClose,
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
  onClose: () => void;
}) {
  const selected = value ? parseISO(value) : undefined;

  return (
    <>
      <Calendar
        mode="single"
        selected={selected}
        onSelect={(date) => {
          onChange(date ? format(date, "yyyy-MM-dd") : null);
          onClose();
        }}
        initialFocus
      />
      {selected && (
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              onChange(null);
              onClose();
            }}
          >
            Clear date
          </Button>
        </div>
      )}
    </>
  );
}

/**
 * Default full-width Popover trigger — used by the task detail panel. In
 * compact contexts (task rows), wrap DueDatePickerContent with a Popover
 * + custom trigger.
 */
export function DueDatePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start font-normal">
          <CalendarIcon className="h-4 w-4 mr-2" />
          {selected ? (
            format(selected, "MMM d, yyyy")
          ) : (
            <span className="text-muted-foreground">No due date</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0 w-auto">
        <DueDatePickerContent value={value} onChange={onChange} onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

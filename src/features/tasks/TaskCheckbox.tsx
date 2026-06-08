import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";

import { cn } from "@/lib/utils";

/**
 * Task completion checkbox — the round, green-fill "Done" icon used in
 * the task list rows and in the detail panel's subtasks. Mirrors the
 * Figma design exactly: a 1px #708597 hollow circle when off, and a
 * filled #00BC7C circle with a 1.5px white checkmark when on.
 *
 * Kept as its own component (instead of restyling the generic shadcn
 * Checkbox) so other Checkbox usages — settings toggles, form fields —
 * stay on the default square design.
 */
export const TaskCheckbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "grid place-content-center peer shrink-0 rounded-full border border-[#708597]/60 transition-colors",
      "hover:border-[#00BC7C]",
      "data-[state=checked]:bg-[#00BC7C] data-[state=checked]:border-[#00BC7C] data-[state=checked]:text-white",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="grid place-content-center text-current">
      {/* Inline path taken straight from the Figma asset (18×18 viewBox,
          1.5px round-capped white check). currentColor lets the parent
          control fill/stroke via data-[state=checked]:text-white. */}
      <svg
        viewBox="0 0 18 18"
        className="h-full w-full"
        fill="none"
        aria-hidden
      >
        <path
          d="M6.75 9L8.25 10.5L11.25 7.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
TaskCheckbox.displayName = "TaskCheckbox";

import { cn } from "@/lib/utils";

/**
 * Renders a catalog item's icon, or a neutral muted square when the item
 * has no logo (e.g. advertising clients). `className` carries the size +
 * shape (h-5 w-5 rounded, h-6 w-6 rounded-full, …) so the placeholder
 * occupies the same box as a real icon.
 */
export function BrandThumb({
  thumbnail,
  className,
}: {
  thumbnail?: string;
  className?: string;
}) {
  if (!thumbnail) {
    return <span className={cn("bg-muted shrink-0", className)} aria-hidden />;
  }
  return (
    <img src={thumbnail} alt="" className={cn("object-cover shrink-0", className)} />
  );
}

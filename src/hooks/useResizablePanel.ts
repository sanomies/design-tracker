import { useEffect, useRef, useState } from "react";

const DEFAULT_STORAGE_KEY = "design-tracker:task-panel-width";

type Args = {
  defaultWidth: number;
  min: number;
  max: number;
  /** Minimum room the parent layout must keep for siblings (e.g., task list). */
  reservedSiblingWidth?: number;
  /** localStorage key — falls back to the task-panel default for back-compat
   *  with the original call site. Pass a unique value when reusing the hook
   *  for a different region (e.g., the sidebar). */
  storageKey?: string;
  /** Which side of the panel the resize handle lives on. `"left"` (default)
   *  matches the right-side task detail panel — dragging the handle LEFT
   *  grows the panel. `"right"` is for a left-side sidebar with its handle
   *  on the right edge — dragging RIGHT grows the panel. */
  handleSide?: "left" | "right";
};

/**
 * Drag-to-resize a side panel. Width is persisted to localStorage and
 * re-clamped on window resize so it never exceeds the viewport.
 *
 * Used by both the right-side task detail panel (handle on its left edge)
 * and the left-side sidebar (handle on its right edge); the `handleSide`
 * option flips the drag direction so both feel natural.
 */
export function useResizablePanel({
  defaultWidth,
  min,
  max,
  reservedSiblingWidth = 320,
  storageKey = DEFAULT_STORAGE_KEY,
  handleSide = "left",
}: Args) {
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === "undefined") return defaultWidth;
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : defaultWidth;
  });
  const [isResizing, setIsResizing] = useState(false);
  const startRef = useRef<{ x: number; width: number } | null>(null);

  const clamp = (value: number): number => {
    if (typeof window === "undefined") return Math.max(min, Math.min(max, value));
    const dynamicMax = Math.max(min, Math.min(max, window.innerWidth - reservedSiblingWidth));
    return Math.max(min, Math.min(dynamicMax, value));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, width };
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const onMove = (e: PointerEvent) => {
      if (!startRef.current) return;
      // handleSide=left → handle on panel's left edge, drag LEFT to grow.
      // handleSide=right → handle on panel's right edge, drag RIGHT to grow.
      const delta =
        handleSide === "left"
          ? startRef.current.x - e.clientX
          : e.clientX - startRef.current.x;
      setWidth(clamp(startRef.current.width + delta));
    };
    const onUp = () => {
      startRef.current = null;
      setIsResizing(false);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResizing, handleSide]);

  // Persist user-chosen width.
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(storageKey, String(width));
  }, [width, storageKey]);

  // Re-clamp when the viewport shrinks below current width.
  useEffect(() => {
    const onResize = () => setWidth((w) => clamp(w));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { width, isResizing, onPointerDown };
}

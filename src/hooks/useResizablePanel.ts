import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "design-tracker:task-panel-width";

type Args = {
  defaultWidth: number;
  min: number;
  max: number;
  /** Minimum room the parent layout must keep for siblings (e.g., task list). */
  reservedSiblingWidth?: number;
};

/**
 * Drag-to-resize a right-side panel. Width is persisted to localStorage and
 * re-clamped on window resize so it never exceeds the viewport.
 */
export function useResizablePanel({
  defaultWidth,
  min,
  max,
  reservedSiblingWidth = 320,
}: Args) {
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === "undefined") return defaultWidth;
    const raw = localStorage.getItem(STORAGE_KEY);
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
      // Handle sits on the LEFT edge of the panel — drag left = wider.
      const delta = startRef.current.x - e.clientX;
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
  }, [isResizing]);

  // Persist user-chosen width.
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, String(width));
  }, [width]);

  // Re-clamp when the viewport shrinks below current width.
  useEffect(() => {
    const onResize = () => setWidth((w) => clamp(w));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { width, isResizing, onPointerDown };
}

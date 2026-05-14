import { useEffect, useRef, useState } from "react";

type Args = {
  /** localStorage key — pass a unique value per use-site so different
   *  resizable regions don't trample each other's persisted height. */
  storageKey: string;
  defaultHeight: number;
  min: number;
  max: number;
  /** If set, dragging the (unclamped) height below this value during a drag
   *  fires `onCollapse` and ends the drag in-flight. Use with a value
   *  noticeably below `min` so a regular "shrink to min" doesn't trip it. */
  collapseAt?: number;
  onCollapse?: () => void;
};

/**
 * Drag-to-resize for a bottom-docked panel. The handle is expected to sit on
 * the panel's TOP edge — dragging UP grows the panel. Height is persisted to
 * localStorage and bounded to [min, max].
 */
export function useResizableHeight({
  storageKey,
  defaultHeight,
  min,
  max,
  collapseAt,
  onCollapse,
}: Args) {
  const [height, setHeight] = useState<number>(() => {
    if (typeof window === "undefined") return defaultHeight;
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : defaultHeight;
  });
  const [isResizing, setIsResizing] = useState(false);
  const startRef = useRef<{ y: number; height: number } | null>(null);

  const clamp = (v: number) => Math.max(min, Math.min(max, v));

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    startRef.current = { y: e.clientY, height };
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;
    // Per-drag flag so the collapse handler only fires once even if the
    // cursor keeps moving past the threshold.
    let collapsed = false;

    const onMove = (e: PointerEvent) => {
      if (!startRef.current) return;
      // Handle sits on the TOP edge — drag up = bigger.
      const delta = startRef.current.y - e.clientY;
      const target = startRef.current.height + delta;
      if (
        !collapsed &&
        collapseAt !== undefined &&
        onCollapse &&
        target < collapseAt
      ) {
        collapsed = true;
        onCollapse();
        startRef.current = null;
        setIsResizing(false);
        return;
      }
      setHeight(clamp(target));
    };
    const onUp = () => {
      startRef.current = null;
      setIsResizing(false);
    };

    document.body.style.cursor = "row-resize";
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
  }, [isResizing, collapseAt, onCollapse]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(storageKey, String(height));
  }, [height, storageKey]);

  return { height, isResizing, onPointerDown };
}

import { useEffect, useState } from "react";

// Matches a pointing device that can hover — a mouse or trackpad. Returns
// false on touch / coarse-pointer contexts (phones, tablets, touchscreen
// laptops in tablet mode, and Chrome DevTools device emulation), where
// `:hover` and `group-hover` never fire. Use it to decide whether a control
// can rely on hover to reveal itself, or must be shown some other way.
const HOVER_QUERY = "(hover: hover)";

export function useHasHover(): boolean {
  const [hasHover, setHasHover] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia(HOVER_QUERY).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(HOVER_QUERY);
    const onChange = (e: MediaQueryListEvent) => setHasHover(e.matches);
    mql.addEventListener("change", onChange);
    setHasHover(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return hasHover;
}

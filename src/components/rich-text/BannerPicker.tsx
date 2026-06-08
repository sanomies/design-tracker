import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  BANNER_CATALOG,
  CATEGORY_LABELS,
  matchBanners,
  type Banner,
  type BannerCategory,
} from "./bannerCatalog";

export type AnchorTarget =
  | { type: "element"; element: HTMLElement }
  | { type: "virtual"; rect: DOMRect };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: AnchorTarget | null;
  initialFilter: string;
  insertedIds: Set<string>;
  onInsert: (banner: Banner) => void;
};

type Section = {
  key: string;
  label: string;
  banners: Banner[];
};

export function BannerPicker({
  open,
  onOpenChange,
  anchor,
  initialFilter,
  insertedIds,
  onInsert,
}: Props) {
  const [query, setQuery] = useState(initialFilter);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset state whenever the picker is reopened.
  useEffect(() => {
    if (open) {
      setQuery(initialFilter);
      setHighlight(0);
    }
  }, [open, initialFilter]);

  // Stable category order — sections never reshuffle when an item is picked,
  // so the user's mental map of where each banner lives doesn't shift.
  const sections = useMemo<Section[]>(() => {
    const filtered = matchBanners(query);
    const out: Section[] = [];
    (["desktop", "mobile", "social"] as BannerCategory[]).forEach((cat) => {
      const banners = filtered.filter((b) => b.category === cat);
      if (banners.length > 0) {
        out.push({ key: cat, label: CATEGORY_LABELS[cat], banners });
      }
    });
    return out;
  }, [query]);

  // Flat ordered list of all visible banners, in section order. The highlight
  // index walks this list.
  const flat = useMemo(() => sections.flatMap((s) => s.banners), [sections]);

  // Clamp highlight whenever the filtered list shrinks.
  useEffect(() => {
    setHighlight((i) => (flat.length === 0 ? 0 : Math.min(i, flat.length - 1)));
  }, [flat.length]);

  // Scroll the highlighted row into view on keyboard navigation. We tag
  // each row with data-banner-index and use scroll-margin-top on the button
  // (set inline below) so the sticky section header doesn't cover it.
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current?.querySelector<HTMLButtonElement>(
      `[data-banner-index="${highlight}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  const handleInsert = useCallback(
    (banner: Banner) => {
      onInsert(banner);
      // Keep focus in the input so the user can immediately filter again.
      inputRef.current?.focus();
    },
    [onInsert]
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (flat.length === 0) return;
      setHighlight((i) => Math.min(i + 1, flat.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (flat.length === 0) return;
      setHighlight((i) => Math.max(i - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const banner = flat[highlight];
      if (banner) handleInsert(banner);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      // Stop the native event from reaching the window-level Escape listener
      // on the task panel, which would otherwise close the whole panel.
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      onOpenChange(false);
      return;
    }
  };

  if (!anchor) return null;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <BannerAnchor anchor={anchor} />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          side="bottom"
          sideOffset={6}
          // Don't steal focus from the editor on close (Radix returns focus
          // to the trigger by default — there is no trigger here).
          onCloseAutoFocus={(e) => e.preventDefault()}
          onKeyDown={onKeyDown}
          className={cn(
            "z-50 w-80 rounded-md border bg-popover text-popover-foreground shadow-md outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        >
          <div className="relative border-b">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              placeholder="Search banners…"
              className="w-full bg-transparent py-2 pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div ref={scrollRef} className="max-h-72 overflow-y-auto">
            {sections.length === 0 && (
              <div className="px-2 py-3 text-xs text-muted-foreground">
                No matching banners
              </div>
            )}
            {sections.map((section, sIndex) => {
              const startIndex = flat.indexOf(section.banners[0]!);
              return (
                // Sticky header is the section's top edge — no margin / padding
                // above it, so previous items scroll straight under the opaque
                // header instead of through a gap.
                <div key={section.key} className="px-1 pb-1">
                  <div
                    className={cn(
                      "sticky top-0 z-10 bg-popover px-2 pb-1.5 pt-2 text-xs font-semibold uppercase tracking-wide text-foreground",
                      sIndex > 0 && "border-t"
                    )}
                  >
                    {section.label}
                  </div>
                  {section.banners.map((banner, i) => {
                    const flatIndex = startIndex + i;
                    const selected = flatIndex === highlight;
                    const inserted = insertedIds.has(banner.id);
                    return (
                      <button
                        key={banner.id}
                        type="button"
                        data-banner-index={flatIndex}
                        // scrollMarginTop leaves room for the sticky section
                        // header when scrollIntoView pulls this row to the top.
                        style={{ scrollMarginTop: 36, scrollMarginBottom: 4 }}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setHighlight(flatIndex)}
                        onClick={() => handleInsert(banner)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm",
                          selected
                            ? "bg-accent"
                            : inserted
                              ? "bg-accent/50 hover:bg-accent/70"
                              : "hover:bg-accent/50"
                        )}
                      >
                        <BannerThumb banner={banner} />
                        <span className="flex-1 truncate">
                          <HighlightedText text={banner.name} query={query} />
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            {banner.size}
                          </span>
                        </span>
                        {inserted && (
                          <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className="border-t px-2 py-1 text-[10px] text-muted-foreground">
            {flat.length} of {BANNER_CATALOG.length} • Enter to insert • Esc to close
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** Bridges our `AnchorTarget` to a Radix PopoverAnchor. For element anchors
 *  we forward via virtualRef so we don't have to clone children. For virtual
 *  anchors (cursor coords) we pass a static rect. */
function BannerAnchor({ anchor }: { anchor: AnchorTarget }) {
  const ref = useRef<{ getBoundingClientRect: () => DOMRect } | null>(null);
  if (anchor.type === "element") {
    ref.current = anchor.element;
  } else {
    ref.current = { getBoundingClientRect: () => anchor.rect };
  }
  return <PopoverPrimitive.Anchor virtualRef={ref as React.RefObject<HTMLElement>} />;
}

/** Tiny preview rectangle for a banner. The rectangle is scaled to the
 *  banner's first dimension pair, fit inside a fixed 28×20 box so all rows
 *  align vertically. Composite banners ("1600x300 + 1600x100") get a small
 *  "+N" badge counting the extra parts. */
function BannerThumb({ banner }: { banner: Banner }) {
  const BOX_W = 28;
  const BOX_H = 20;
  const parts = banner.size.split(/\s*\+\s*/);
  const match = parts[0]?.match(/(\d+)\s*x\s*(\d+)/);
  const extra = parts.length - 1;

  let dispW = BOX_W;
  let dispH = BOX_H;
  if (match) {
    const w = parseInt(match[1]!, 10);
    const h = parseInt(match[2]!, 10);
    const scale = Math.min(BOX_W / w, BOX_H / h);
    dispW = Math.max(3, Math.round(w * scale));
    dispH = Math.max(3, Math.round(h * scale));
  }

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: BOX_W, height: BOX_H }}
      aria-hidden
    >
      <div
        className="rounded-[2px] border border-muted-foreground/30 bg-gradient-to-r from-muted-foreground/30 to-muted-foreground/15"
        style={{ width: dispW, height: dispH }}
      />
      {extra > 0 && (
        <span className="absolute -left-1 -top-1 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-none text-primary-foreground">
          +{extra}
        </span>
      )}
    </div>
  );
}

/** Wraps any case-insensitive match of `query` in the banner name with a
 *  <mark>. Only matches the name (not the size) since the size is rendered
 *  separately and already small/muted. */
function HighlightedText({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  const idx = lower.indexOf(ql);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-foreground rounded-sm">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

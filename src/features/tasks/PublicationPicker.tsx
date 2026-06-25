import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { catalogItem, groupItems, pluralLabel, type CatalogProfile } from "./catalog";
import { useCatalog } from "./CatalogProvider";
import { BrandThumb } from "./BrandThumb";
import { type Publication } from "./publications";

type FlatItem =
  | { kind: "none"; slug: null }
  | { kind: "pub"; slug: string; publication: Publication };

/**
 * Popover content for choosing a brand/product. Type-ahead: any printable
 * key narrows the list, arrow keys move the active highlight, Enter
 * commits, Esc closes. There is no visible search input — keystrokes are
 * captured on a hidden field that holds focus while the popover is open.
 *
 * The catalog (items, grouping, "Brand" vs "Product" wording) comes from
 * the active CatalogProfile in context, so the same picker serves every
 * project kind. The picker itself doesn't own a trigger — callers wrap it
 * however they want (full-width button in the detail panel, compact cell
 * in a row).
 */
export function PublicationPickerContent({
  value,
  onChange,
  onClose,
}: {
  value: string | null;
  onChange: (slug: string | null) => void;
  onClose: () => void;
}) {
  const profile = useCatalog();
  const label = profile.itemLabel.toLowerCase();
  const plural = pluralLabel(profile).toLowerCase();

  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const matches = useMemo(
    () =>
      q
        ? profile.items.filter((p) => p.name.toLowerCase().includes(q))
        : profile.items,
    [q, profile]
  );

  const groups = useMemo(() => groupItems(profile, matches), [profile, matches]);

  // Flat list of selectable items in render order. Drives arrow-key
  // navigation and resolves Enter to a slug.
  const flatItems = useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = [];
    if (q === "") items.push({ kind: "none", slug: null });
    for (const group of groups) {
      for (const p of group.items) {
        items.push({ kind: "pub", slug: p.slug, publication: p });
      }
    }
    return items;
  }, [groups, q]);

  // Initial active = currently-selected value if visible, otherwise 0.
  const [activeIdx, setActiveIdx] = useState(() =>
    computeInitialActive(profile, value)
  );

  // Reset to first item whenever the query changes.
  useEffect(() => {
    setActiveIdx(0);
  }, [q]);

  // Clamp activeIdx if filtering shrinks the list below it.
  useEffect(() => {
    if (activeIdx >= flatItems.length) {
      setActiveIdx(Math.max(0, flatItems.length - 1));
    }
  }, [flatItems.length, activeIdx]);

  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    itemRefs.current[activeIdx]?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  function commit(slug: string | null) {
    onChange(slug);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (flatItems.length > 0) {
        setActiveIdx((i) => (i + 1) % flatItems.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (flatItems.length > 0) {
        setActiveIdx((i) => (i - 1 + flatItems.length) % flatItems.length);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = flatItems[activeIdx];
      if (it) commit(it.slug);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Backspace") {
      // let the input handle it natively
    }
  }

  // Walk the flat list while rendering to know each button's flat index
  // (used both for highlight and for ref array indexing).
  let idx = 0;
  // Clear refs at the top of each render so stale entries don't linger
  // when matches shrink.
  itemRefs.current = [];

  return (
    <>
      {/* Visually-hidden input that captures all keystrokes. The popover
          auto-focuses the first focusable child, so this stays focused
          for the lifetime of the popover. */}
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label={`Filter ${plural}`}
        className="sr-only"
      />
      {q !== "" && (
        <div className="px-2 pt-1 pb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Filtering: {query}
        </div>
      )}
      {flatItems.length === 0 && (
        <div className="px-2 py-3 text-sm text-muted-foreground text-center">
          No {plural} match
        </div>
      )}
      {q === "" &&
        (() => {
          const itemIdx = idx++;
          return (
            <button
              ref={(el) => {
                itemRefs.current[itemIdx] = el;
              }}
              type="button"
              className={cn(
                "w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm",
                activeIdx === itemIdx && "bg-accent",
                value === null && "font-medium"
              )}
              onMouseEnter={() => setActiveIdx(itemIdx)}
              onClick={() => commit(null)}
            >
              <span className="h-5 w-5 rounded bg-muted shrink-0" aria-hidden />
              No {label}
            </button>
          );
        })()}
      {groups.map((group, gi) => (
        <div key={group.category ?? `g${gi}`} className="mt-1">
          {group.category !== null && (
            <div className="px-2 pt-1 pb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {group.category}
            </div>
          )}
          {group.items.map((p) => {
            const itemIdx = idx++;
            return (
              <button
                key={p.slug}
                ref={(el) => {
                  itemRefs.current[itemIdx] = el;
                }}
                type="button"
                className={cn(
                  "w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm",
                  activeIdx === itemIdx && "bg-accent",
                  value === p.slug && "font-medium"
                )}
                onMouseEnter={() => setActiveIdx(itemIdx)}
                onClick={() => commit(p.slug)}
              >
                <BrandThumb thumbnail={p.thumbnail} className="h-5 w-5 rounded" />
                <span className="truncate">{p.name}</span>
              </button>
            );
          })}
        </div>
      ))}
    </>
  );
}

// Position of the currently-selected value in the initial unfiltered flat
// list (No <label> first, then grouped items in definition order). Used to
// start the keyboard cursor on the current selection so Enter on open is a
// no-op confirm.
function computeInitialActive(
  profile: CatalogProfile,
  value: string | null
): number {
  if (value === null) return 0;
  let i = 1;
  for (const group of groupItems(profile, profile.items)) {
    for (const p of group.items) {
      if (p.slug === value) return i;
      i++;
    }
  }
  return 0;
}

/**
 * Default full-width Popover trigger — used by the task detail panel.
 * In compact contexts (task rows), wrap PublicationPickerContent in a
 * Popover with a custom trigger instead of using this.
 */
export function PublicationPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (slug: string | null) => void;
}) {
  const profile = useCatalog();
  const [open, setOpen] = useState(false);
  const current = catalogItem(profile, value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start font-normal gap-1.5">
          <BrandThumb thumbnail={current?.thumbnail} className="h-5 w-5 rounded" />
          <span className="truncate">
            {current ? current.name : `No ${profile.itemLabel.toLowerCase()}`}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-1 w-64 max-h-80 overflow-y-auto">
        <PublicationPickerContent
          value={value}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

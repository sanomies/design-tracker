/** Single source of truth for the banner catalog. PMs order from this fixed
 *  list; the editor stores `bannerId` references rather than free text so the
 *  list can be queried, totaled, or exported, and copy output stays consistent
 *  regardless of how the pill renders.
 *
 *  IDs are stable kebab-case slugs that include size, because several names
 *  repeat across sizes (Content, Scroller, Floating, Gallery, Siteheader,
 *  Wallpaper). Once an ID is referenced from a saved description, never
 *  rename it — change the display name/size in place if a banner is renamed. */

export type BannerCategory = "desktop" | "mobile" | "social";

export type Banner = {
  id: string;
  name: string;
  /** Dimension string as displayed. Composite banners use ` + ` between
   *  parts (e.g. "1600x300 + 1600x100"). */
  size: string;
  category: BannerCategory;
  /** Optional extra search terms (e.g. "site header" for "Siteheader"). */
  aliases?: string[];
};

export const BANNER_CATALOG: Banner[] = [
  // Desktop
  { id: "tower-300x600", name: "Tower", size: "300x600", category: "desktop" },
  { id: "content-1200x200", name: "Content", size: "1200x200", category: "desktop" },
  { id: "content-1200x300", name: "Content", size: "1200x300", category: "desktop" },
  { id: "content-1200x400", name: "Content", size: "1200x400", category: "desktop" },
  { id: "scroller-800x35", name: "Scroller", size: "800x35", category: "desktop" },
  { id: "scroller-800x50", name: "Scroller", size: "800x50", category: "desktop" },
  { id: "scroller-800x100", name: "Scroller", size: "800x100", category: "desktop" },
  {
    id: "siteheader-1600x300-1600x100",
    name: "Siteheader",
    size: "1600x300 + 1600x100",
    category: "desktop",
    aliases: ["site header", "header"],
  },
  {
    id: "siteheader-1600x400-1600x100",
    name: "Siteheader",
    size: "1600x400 + 1600x100",
    category: "desktop",
    aliases: ["site header", "header"],
  },
  {
    id: "wallpaper-1920x1080-1200x300",
    name: "Wallpaper",
    size: "1920x1080 + 1200x300",
    category: "desktop",
  },
  {
    id: "wallpaper-1920x1080-1200x400",
    name: "Wallpaper",
    size: "1920x1080 + 1200x400",
    category: "desktop",
  },
  { id: "interstitial-1024x675", name: "Interstitial", size: "1024x675", category: "desktop" },
  {
    id: "pushdown-1200x300-1200x700",
    name: "Pushdown",
    size: "1200x300 + 1200x700",
    category: "desktop",
  },
  {
    id: "page-break-1200x640",
    name: "Page-Break",
    size: "1200x640",
    category: "desktop",
    aliases: ["pagebreak", "page break", "break"],
  },
  { id: "floating-600x600", name: "Floating", size: "600x600", category: "desktop" },
  { id: "floating-700x700", name: "Floating", size: "700x700", category: "desktop" },
  {
    id: "cover-flow-515x330",
    name: "Cover Flow",
    size: "515x330",
    category: "desktop",
    aliases: ["coverflow"],
  },
  { id: "gallery-1920x1080", name: "Gallery", size: "1920x1080", category: "desktop" },
  {
    id: "fullscreen-siteheader-1280x720-1600x100",
    name: "Fullscreen Siteheader",
    size: "1280x720 + 1600x100",
    category: "desktop",
    aliases: ["fullscreen header", "site header"],
  },

  // Mobile
  { id: "mobile-600x500", name: "Mobile", size: "600x500", category: "mobile" },
  {
    id: "mobile-interstitial-600x800",
    name: "Mobile Interstitial",
    size: "600x800",
    category: "mobile",
  },
  {
    id: "pushdown-mobile-300x150-300x600",
    name: "Pushdown Mobile",
    size: "300x150 + 300x600",
    category: "mobile",
  },
  {
    id: "mobile-interscroller-360x640",
    name: "Mobile Interscroller",
    size: "360x640",
    category: "mobile",
    aliases: ["interscroller"],
  },
  {
    id: "mobile-siteheader-600x250-600x100",
    name: "Mobile Siteheader",
    size: "600x250 + 600x100",
    category: "mobile",
    aliases: ["mobile site header", "mobile header"],
  },
  {
    id: "gallery-mobile-1080x1920",
    name: "Gallery",
    size: "1080x1920",
    category: "mobile",
  },

  // Social
  { id: "square-1200x1200", name: "Square", size: "1200x1200", category: "social" },
  { id: "story-1080x1920", name: "Story", size: "1080x1920", category: "social" },
];

const BY_ID = new Map(BANNER_CATALOG.map((b) => [b.id, b] as const));

export function getBanner(id: string): Banner | undefined {
  return BY_ID.get(id);
}

export const CATEGORY_LABELS: Record<BannerCategory, string> = {
  desktop: "Desktop banners",
  mobile: "Mobile banners",
  social: "Social media banners",
};

/** Format used by the pill label and by the copy-dimensions clipboard output:
 *  "Name — Dimensions". */
export function formatBannerLabel(b: Banner): string {
  return `${b.name} — ${b.size}`;
}

/** Tokens that the size string contributes to the search index. The full
 *  string and each digit chunk between `x`, `+`, or whitespace count, so
 *  `1920`, `1080`, `800x35`, `1920x1080+1200x300` all match an entry whose
 *  size includes them. */
function sizeTokens(size: string): string[] {
  const tokens = new Set<string>();
  tokens.add(size.toLowerCase().replace(/\s+/g, ""));
  size
    .toLowerCase()
    .split(/[x+\s]+/)
    .filter(Boolean)
    .forEach((t) => tokens.add(t));
  // Also add each <digits>x<digits> pair so "800x35" matches without
  // needing the full composite string.
  for (const part of size.split(/\s*\+\s*/)) {
    tokens.add(part.toLowerCase().replace(/\s+/g, ""));
  }
  return [...tokens];
}

/** Pre-compute a flat searchable index so per-keystroke filtering is cheap. */
const SEARCH_INDEX = BANNER_CATALOG.map((b) => ({
  banner: b,
  haystack: [
    b.name.toLowerCase(),
    ...sizeTokens(b.size),
    ...(b.aliases ?? []).map((a) => a.toLowerCase()),
  ],
}));

/** Filter banners by a free-text query. Tokens (whitespace-separated) all
 *  must match somewhere in the banner's name / size digits / aliases. */
export function matchBanners(query: string): Banner[] {
  const q = query.trim().toLowerCase();
  if (!q) return BANNER_CATALOG;
  const terms = q.split(/\s+/);
  return SEARCH_INDEX.filter(({ haystack }) =>
    terms.every((term) => haystack.some((h) => h.includes(term)))
  ).map(({ banner }) => banner);
}

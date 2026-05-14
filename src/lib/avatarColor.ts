// Deterministic light-pastel background + matching dark text colors for
// avatar fallbacks. Hashing the user's id picks a palette slot, so the
// same person renders the same color everywhere (rows, popovers, inbox,
// comment threads, etc.).

const PALETTE = [
  "bg-rose-100 text-rose-900",
  "bg-pink-100 text-pink-900",
  "bg-fuchsia-100 text-fuchsia-900",
  "bg-violet-100 text-violet-900",
  "bg-indigo-100 text-indigo-900",
  "bg-blue-100 text-blue-900",
  "bg-sky-100 text-sky-900",
  "bg-cyan-100 text-cyan-900",
  "bg-teal-100 text-teal-900",
  "bg-emerald-100 text-emerald-900",
  "bg-lime-100 text-lime-900",
  "bg-amber-100 text-amber-900",
  "bg-orange-100 text-orange-900",
];

function hash(s: string): number {
  // djb2-ish; we just need stable + well-distributed across small N.
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Returns Tailwind classes for an avatar fallback's background + text. */
export function avatarColor(id: string | null | undefined): string {
  if (!id) return "bg-muted text-muted-foreground";
  return PALETTE[hash(id) % PALETTE.length]!;
}

import type { Profile } from "@/types/database";

/** Two-letter uppercase initials for an avatar fallback. */
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Resolves a profile id to a display name against the workspace member list. */
export function authorName(
  authorId: string | null,
  members: Profile[],
  selfId: string | undefined
): string {
  if (!authorId) return "Unknown";
  if (authorId === selfId) {
    const me = members.find((m) => m.id === authorId);
    return me?.full_name ?? "You";
  }
  return members.find((m) => m.id === authorId)?.full_name ?? "Unknown";
}

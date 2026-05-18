import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import type { Project, Task } from "@/types/database";

const RECENTS_KEY = "design-tracker:recent-tasks";
const MAX_RECENTS = 10;
const CHANGE_EVENT = "design-tracker:recent-tasks-changed";

export type RecentTaskRow = Task & {
  project: Pick<Project, "id" | "name" | "color" | "workspace_id"> | null;
};

function readIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((v): v is string => typeof v === "string").slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

/**
 * Push a task id onto the recent-tasks stack. Most-recent first, deduped,
 * capped at MAX_RECENTS. Fires a window event so the combobox re-renders
 * its recents list immediately.
 */
export function recordTaskOpened(taskId: string) {
  if (typeof window === "undefined") return;
  try {
    const current = readIds();
    const next = [taskId, ...current.filter((id) => id !== taskId)].slice(0, MAX_RECENTS);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // ignore quota / private mode
  }
}

export function useRecentTaskIds(): string[] {
  const [ids, setIds] = useState<string[]>(() => readIds());
  useEffect(() => {
    const onChange = () => setIds(readIds());
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);
  return ids;
}

/**
 * Fetch full task rows (joined with project) for an arbitrary list of
 * task ids — used by the search combobox to render recents. Preserves
 * the input order so most-recently-opened stays first.
 */
export function useTasksByIds(ids: string[]) {
  return useQuery({
    queryKey: ["tasks-by-ids", ids] as const,
    queryFn: async (): Promise<RecentTaskRow[]> => {
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("*, project:projects(id, name, color, workspace_id)")
        .in("id", ids);
      if (error) throw error;
      const map = new Map<string, RecentTaskRow>();
      for (const row of (data ?? []) as RecentTaskRow[]) {
        map.set(row.id, row);
      }
      return ids
        .map((id) => map.get(id))
        .filter((t): t is RecentTaskRow => t !== undefined);
    },
    enabled: ids.length > 0,
    staleTime: 30_000,
  });
}

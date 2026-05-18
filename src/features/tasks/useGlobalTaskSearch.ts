import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import type { Project, Task } from "@/types/database";

export type SearchResultTask = Task & {
  project: Pick<Project, "id" | "name" | "color" | "workspace_id"> | null;
};

/**
 * Searches tasks by title across every project the user has access to.
 * RLS does the access filtering server-side; we just send the ilike.
 *
 * - Empty query → disabled (don't burn a request).
 * - 250ms staleTime so rapid typing reuses cached results.
 */
export function useGlobalTaskSearch(query: string, enabled: boolean = true) {
  const q = query.trim();
  return useQuery({
    queryKey: ["task-search", q] as const,
    queryFn: async (): Promise<SearchResultTask[]> => {
      if (!q) return [];
      // Escape LIKE wildcards so a typed % or _ doesn't match the world.
      const escaped = q.replace(/[\\%_]/g, (m) => `\\${m}`);
      const { data, error } = await supabase
        .from("tasks")
        .select("*, project:projects(id, name, color, workspace_id)")
        .ilike("title", `%${escaped}%`)
        .limit(20);
      if (error) throw error;
      return (data ?? []) as SearchResultTask[];
    },
    enabled: enabled && q.length > 0,
    staleTime: 30_000,
  });
}

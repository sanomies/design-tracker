import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/AuthProvider";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { supabase } from "@/lib/supabase";

const unseenKey = ["unseen-projects"] as const;

/**
 * Set of project ids that have at least one task added (by someone other than
 * the current user) since the user last opened them. Powers the small "unseen
 * tasks" dot after a project name in the sidebar / mobile project list.
 *
 * Backed by the `unseen_project_ids()` RPC — one round-trip covers every
 * project, so the sidebar never has to load each project's task list to know
 * whether to show a dot. A workspace-wide realtime subscription on `tasks`
 * invalidates the query, so the dot lights up live when a teammate adds a
 * task. (RLS scopes realtime events to tasks the user can read, so this only
 * ever fires for the user's own projects.)
 */
export function useUnseenProjects(): Set<string> {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: unseenKey,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc("unseen_project_ids");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  useRealtimeInvalidate({
    table: "tasks",
    queryKey: unseenKey,
    enabled: !!user,
  });

  return useMemo(() => new Set(data ?? []), [data]);
}

/**
 * Marks a project seen (clears its dot), fired when the user opens a project.
 * Optimistically drops the id from the unseen set so the dot disappears
 * instantly, then re-validates against the server.
 */
export function useMarkProjectSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string): Promise<void> => {
      const { error } = await supabase.rpc("mark_project_seen", {
        _project_id: projectId,
      });
      if (error) throw error;
    },
    onMutate: async (projectId) => {
      await qc.cancelQueries({ queryKey: unseenKey });
      const previous = qc.getQueryData<string[]>(unseenKey);
      qc.setQueryData<string[]>(unseenKey, (old = []) =>
        old.filter((id) => id !== projectId)
      );
      return { previous };
    },
    onError: (_err, _projectId, context) => {
      if (context?.previous) qc.setQueryData(unseenKey, context.previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: unseenKey });
    },
  });
}

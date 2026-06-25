import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/AuthProvider";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { supabase } from "@/lib/supabase";
import type { Project, Task, TaskUpdate } from "@/types/database";

export type MyTaskRow = Task & {
  project: Pick<Project, "id" | "name" | "color" | "workspace_id" | "kind"> | null;
};

const myTasksKey = (userId: string | undefined) => ["my-tasks", userId] as const;

/**
 * Fetches every task assigned to the current user across all workspaces /
 * projects the user has access to. Joined with the parent project so the
 * UI can show project context.
 *
 * Subtasks are included — if a subtask is assigned to the user but its
 * parent is not, hiding it would make the assignment effectively invisible.
 */
export function useMyTasks() {
  const { user } = useAuth();
  const userId = user?.id;

  const result = useQuery({
    queryKey: myTasksKey(userId),
    queryFn: async (): Promise<MyTaskRow[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("*, project:projects(id, name, color, workspace_id, kind)")
        .eq("assignee_id", userId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MyTaskRow[];
    },
    enabled: !!userId,
  });

  useRealtimeInvalidate({
    table: "tasks",
    queryKey: myTasksKey(userId),
    enabled: !!userId,
  });

  return result;
}

/**
 * Update a task and optimistically reflect it in the my-tasks cache. Used
 * by MyTasksPage drag-drop to move tasks between personal sections and to
 * reorder within a section. Also handles status flips, etc.
 *
 * Per-project caches will refresh via the tasks realtime subscription.
 */
export function useUpdateMyTask() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TaskUpdate }): Promise<Task> => {
      const { data, error } = await supabase
        .from("tasks")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: myTasksKey(userId) });
      const previous = qc.getQueryData<MyTaskRow[]>(myTasksKey(userId));
      qc.setQueryData<MyTaskRow[]>(myTasksKey(userId), (old = []) =>
        old.map((t) => (t.id === id ? { ...t, ...patch } : t))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(myTasksKey(userId), context.previous);
      }
      toast.error("Failed to update task");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: myTasksKey(userId) });
    },
  });
}

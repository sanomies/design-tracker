import { useQuery } from "@tanstack/react-query";

import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { supabase } from "@/lib/supabase";
import type { TaskActivity } from "@/types/database";

const activityKey = (taskId: string | undefined) => ["task-activity", taskId] as const;

/**
 * System-generated activity entries for a task ("X moved this task…", "X
 * removed the due date", …), written by the on_task_activity DB trigger.
 * Read-only on the client — there are no mutations because the trigger is the
 * sole writer. Fetched + kept live exactly like comments so the two can be
 * interleaved chronologically in the task detail stream.
 */
export function useTaskActivity(taskId: string | undefined) {
  const result = useQuery({
    queryKey: activityKey(taskId),
    queryFn: async (): Promise<TaskActivity[]> => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from("task_activity")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });

  useRealtimeInvalidate({
    table: "task_activity",
    filter: taskId ? `task_id=eq.${taskId}` : undefined,
    queryKey: activityKey(taskId),
    enabled: !!taskId,
  });

  return result;
}

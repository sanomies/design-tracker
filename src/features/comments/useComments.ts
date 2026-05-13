import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import type { Comment } from "@/types/database";

const commentsKey = (taskId: string | undefined) => ["comments", taskId] as const;

export function useComments(taskId: string | undefined) {
  return useQuery({
    queryKey: commentsKey(taskId),
    queryFn: async (): Promise<Comment[]> => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });
}

export function useCreateComment(taskId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (body: string): Promise<Comment> => {
      if (!taskId) throw new Error("No task");
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("comments")
        .insert({ task_id: taskId, author_id: user.id, body })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: commentsKey(taskId) });
      const previous = qc.getQueryData<Comment[]>(commentsKey(taskId));
      const optimistic: Comment = {
        id: `temp-${crypto.randomUUID()}`,
        task_id: taskId ?? "",
        author_id: user?.id ?? null,
        body,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<Comment[]>(commentsKey(taskId), (old = []) => [...old, optimistic]);
      return { previous };
    },
    onError: (_err, _body, context) => {
      if (context?.previous) {
        qc.setQueryData(commentsKey(taskId), context.previous);
      }
      toast.error("Failed to post comment");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: commentsKey(taskId) });
    },
  });
}

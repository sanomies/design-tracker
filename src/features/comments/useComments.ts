import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/AuthProvider";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { supabase } from "@/lib/supabase";
import type { Comment } from "@/types/database";

const commentsKey = (taskId: string | undefined) => ["comments", taskId] as const;

export function useComments(taskId: string | undefined) {
  const result = useQuery({
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

  useRealtimeInvalidate({
    table: "comments",
    filter: taskId ? `task_id=eq.${taskId}` : undefined,
    queryKey: commentsKey(taskId),
    enabled: !!taskId,
  });

  return result;
}

/**
 * Updates a comment's body. RLS restricts this to the comment author, so the
 * UI must gate the call. Optimistically rewrites the cache so the change is
 * instant even before realtime echo arrives.
 */
export function useUpdateComment(taskId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      commentId,
      body,
    }: {
      commentId: string;
      body: string;
    }): Promise<Comment> => {
      const { data, error } = await supabase
        .from("comments")
        .update({ body })
        .eq("id", commentId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ commentId, body }) => {
      await qc.cancelQueries({ queryKey: commentsKey(taskId) });
      const previous = qc.getQueryData<Comment[]>(commentsKey(taskId));
      qc.setQueryData<Comment[]>(commentsKey(taskId), (old = []) =>
        old.map((c) => (c.id === commentId ? { ...c, body } : c))
      );
      return { previous };
    },
    onError: (_err, _v, context) => {
      if (context?.previous) {
        qc.setQueryData(commentsKey(taskId), context.previous);
      }
      toast.error("Failed to update comment");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: commentsKey(taskId) });
    },
  });
}

/**
 * Deletes a comment. RLS restricts this to the comment author. The UI must
 * still gate the call (we don't render the action for non-authors), but the
 * policy is the source of truth.
 *
 * Storage cleanup for inline images is handled by the caller, since this
 * hook only knows about the database row.
 */
export function useDeleteComment(taskId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string): Promise<void> => {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId);
      if (error) throw error;
    },
    onMutate: async (commentId) => {
      await qc.cancelQueries({ queryKey: commentsKey(taskId) });
      const previous = qc.getQueryData<Comment[]>(commentsKey(taskId));
      qc.setQueryData<Comment[]>(commentsKey(taskId), (old = []) =>
        old.filter((c) => c.id !== commentId)
      );
      return { previous };
    },
    onError: (_err, _commentId, context) => {
      if (context?.previous) {
        qc.setQueryData(commentsKey(taskId), context.previous);
      }
      toast.error("Failed to delete comment");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: commentsKey(taskId) });
    },
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

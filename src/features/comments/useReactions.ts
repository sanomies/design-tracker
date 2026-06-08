import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/AuthProvider";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { supabase } from "@/lib/supabase";
import type { CommentReaction } from "@/types/database";

/**
 * Reactions for every comment on a given task. We fetch in one query so the
 * UI can render reaction pills for any comment without N+1 round-trips. The
 * caller receives a flat array — group/transform client-side as needed.
 *
 * Realtime: we subscribe to the `comment_reactions` table without a filter
 * because Postgres realtime filters are per-row and can't express "rows
 * whose comment.task_id = X" in one go. RLS still gates which rows the
 * client receives, so cross-project leakage is impossible.
 */
const reactionsKey = (taskId: string | undefined) => ["comment-reactions", taskId] as const;

export function useCommentReactions(taskId: string | undefined) {
  const result = useQuery({
    queryKey: reactionsKey(taskId),
    queryFn: async (): Promise<CommentReaction[]> => {
      if (!taskId) return [];
      // Two-step: fetch comment ids for the task, then fetch reactions for
      // those comments. Doing the inner join in Supabase requires defining
      // an explicit FK relationship hint, which complicates the type story
      // for no real perf win on the dataset sizes we care about.
      const { data: comments, error: commentsErr } = await supabase
        .from("comments")
        .select("id")
        .eq("task_id", taskId);
      if (commentsErr) throw commentsErr;
      const ids = (comments ?? []).map((c) => c.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("comment_reactions")
        .select("*")
        .in("comment_id", ids)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });

  useRealtimeInvalidate({
    table: "comment_reactions",
    queryKey: reactionsKey(taskId),
    enabled: !!taskId,
  });

  return result;
}

/**
 * Toggle a reaction (current user, given comment, given emoji): if the user
 * has already reacted with this emoji on this comment we delete the row,
 * otherwise we insert a new one. Optimistic — the cache updates instantly
 * so the pill flips/appears without waiting on the round-trip.
 */
export function useToggleCommentReaction(taskId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      commentId,
      emoji,
    }: {
      commentId: string;
      emoji: string;
    }): Promise<void> => {
      if (!user) throw new Error("Not signed in");
      // Was the user already reacting? Fetch the row (if any) and use its
      // presence to decide insert vs delete.
      const { data: existing, error: existingErr } = await supabase
        .from("comment_reactions")
        .select("id")
        .eq("comment_id", commentId)
        .eq("user_id", user.id)
        .eq("emoji", emoji)
        .maybeSingle();
      if (existingErr) throw existingErr;
      if (existing) {
        const { error } = await supabase
          .from("comment_reactions")
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("comment_reactions")
          .insert({ comment_id: commentId, user_id: user.id, emoji });
        if (error) throw error;
      }
    },
    onMutate: async ({ commentId, emoji }) => {
      if (!user) return { previous: undefined };
      await qc.cancelQueries({ queryKey: reactionsKey(taskId) });
      const previous = qc.getQueryData<CommentReaction[]>(reactionsKey(taskId));
      qc.setQueryData<CommentReaction[]>(reactionsKey(taskId), (old = []) => {
        const matchIdx = old.findIndex(
          (r) => r.comment_id === commentId && r.user_id === user.id && r.emoji === emoji
        );
        if (matchIdx >= 0) {
          // Toggle off — drop the existing row.
          return [...old.slice(0, matchIdx), ...old.slice(matchIdx + 1)];
        }
        // Toggle on — append an optimistic row with a temp id.
        const optimistic: CommentReaction = {
          id: `temp-${crypto.randomUUID()}`,
          comment_id: commentId,
          user_id: user.id,
          emoji,
          created_at: new Date().toISOString(),
        };
        return [...old, optimistic];
      });
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(reactionsKey(taskId), context.previous);
      }
      // Surface the actual Postgres / Supabase error so we can tell apart
      // "migration not applied", "RLS denied", "FK violation", etc.
      // eslint-disable-next-line no-console
      console.error("[reactions] toggle failed", err);
      const message =
        err instanceof Error && err.message
          ? `Couldn't update reaction: ${err.message}`
          : "Couldn't update reaction";
      toast.error(message);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: reactionsKey(taskId) });
    },
  });
}

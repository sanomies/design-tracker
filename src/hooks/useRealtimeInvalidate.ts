import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

type TableName =
  | "tasks"
  | "comments"
  | "comment_reactions"
  | "attachments"
  | "projects"
  | "sections"
  | "my_task_sections"
  | "workspace_members"
  | "notifications";

/**
 * Subscribes to Supabase Realtime `postgres_changes` for `table` and
 * invalidates `queryKey` whenever an INSERT/UPDATE/DELETE matching `filter`
 * lands. Combined with TanStack Query's refetch-on-invalidate this gives us
 * live sync without bespoke per-table merge logic.
 *
 * `filter` follows Supabase Realtime's column-filter format, e.g.
 * `project_id=eq.<uuid>`. Pass `undefined` to subscribe to all changes.
 *
 * RLS still applies to realtime events — users only get pushed rows they're
 * allowed to read.
 */
export function useRealtimeInvalidate({
  table,
  filter,
  queryKey,
  enabled = true,
}: {
  table: TableName;
  filter?: string;
  queryKey: QueryKey;
  enabled?: boolean;
}) {
  const qc = useQueryClient();
  // Stringify so the effect re-runs only when the array's contents change,
  // not when the parent re-renders with a fresh array reference.
  const queryKeyJson = JSON.stringify(queryKey);

  useEffect(() => {
    if (!enabled) return;

    // Per-effect-instance random suffix. `supabase.channel(name)` REUSES an
    // existing channel by name; if two components subscribe to the same
    // (table, filter), the second call would attach `.on()` to an already-
    // subscribed channel, which Supabase rejects with "cannot add
    // postgres_changes callbacks after subscribe()". A unique name per
    // effect run guarantees a fresh channel for each call site.
    const channelName = `rt:${table}:${crypto.randomUUID()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        },
        () => {
          void qc.invalidateQueries({ queryKey: JSON.parse(queryKeyJson) });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, table, filter, queryKeyJson, qc]);
}

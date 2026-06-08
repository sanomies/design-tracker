import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/AuthProvider";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { supabase } from "@/lib/supabase";
import type { Notification } from "@/types/database";

export type NotificationView = Notification & {
  // Embedded relations from the PostgREST select below. `description` and
  // `body` are pulled in so the inbox row can render a preview of the
  // surrounding text for mention / comment notifications. `project` is
  // pulled in so the redesigned inbox card can render the project pill
  // (coloured dot + name) above the verb row.
  actor: { id: string; full_name: string | null } | null;
  task:
    | {
        id: string;
        title: string;
        project_id: string;
        description: string | null;
        project: { id: string; name: string; color: string | null } | null;
      }
    | null;
  comment: { id: string; body: string } | null;
};

const notificationsKey = (userId: string | undefined) =>
  ["notifications", userId] as const;

export function useNotifications() {
  const { user } = useAuth();

  const result = useQuery({
    queryKey: notificationsKey(user?.id),
    queryFn: async (): Promise<NotificationView[]> => {
      if (!user) return [];
      // PostgREST embed: actor profile + task identity, so the popover can
      // render names and link straight into the task view.
      const { data, error } = await supabase
        .from("notifications")
        .select(`
          *,
          actor:profiles!notifications_actor_id_fkey(id, full_name),
          task:tasks(
            id, title, project_id, description,
            project:projects(id, name, color)
          ),
          comment:comments(id, body)
        `)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as NotificationView[];
    },
    enabled: !!user,
  });

  // Live unread badge + popover updates.
  useRealtimeInvalidate({
    table: "notifications",
    filter: user?.id ? `recipient_id=eq.${user.id}` : undefined,
    queryKey: notificationsKey(user?.id),
    enabled: !!user?.id,
  });

  return result;
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: notificationsKey(user?.id) });
      const previous = qc.getQueryData<NotificationView[]>(notificationsKey(user?.id));
      qc.setQueryData<NotificationView[]>(notificationsKey(user?.id), (old = []) =>
        old.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        qc.setQueryData(notificationsKey(user?.id), context.previous);
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: notificationsKey(user?.id) });
    },
  });
}

export function useMarkNotificationUnread() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: notificationsKey(user?.id) });
      const previous = qc.getQueryData<NotificationView[]>(notificationsKey(user?.id));
      qc.setQueryData<NotificationView[]>(notificationsKey(user?.id), (old = []) =>
        old.map((n) => (n.id === id ? { ...n, read_at: null } : n))
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        qc.setQueryData(notificationsKey(user?.id), context.previous);
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: notificationsKey(user?.id) });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      if (!user) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("recipient_id", user.id)
        .is("read_at", null);
      if (error) throw error;
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: notificationsKey(user?.id) });
      const previous = qc.getQueryData<NotificationView[]>(notificationsKey(user?.id));
      const now = new Date().toISOString();
      qc.setQueryData<NotificationView[]>(notificationsKey(user?.id), (old = []) =>
        old.map((n) => (n.read_at ? n : { ...n, read_at: now }))
      );
      return { previous };
    },
    onError: (_err, _v, context) => {
      if (context?.previous) {
        qc.setQueryData(notificationsKey(user?.id), context.previous);
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: notificationsKey(user?.id) });
    },
  });
}

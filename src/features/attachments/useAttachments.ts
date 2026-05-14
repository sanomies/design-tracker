import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/AuthProvider";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { supabase } from "@/lib/supabase";
import type { Attachment } from "@/types/database";

const ATTACHMENTS_BUCKET = "task-attachments";
const attachmentsKey = (taskId: string | undefined) => ["attachments", taskId] as const;

export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024; // 50 MB

export function useAttachments(taskId: string | undefined) {
  const result = useQuery({
    queryKey: attachmentsKey(taskId),
    queryFn: async (): Promise<Attachment[]> => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from("attachments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });

  useRealtimeInvalidate({
    table: "attachments",
    filter: taskId ? `task_id=eq.${taskId}` : undefined,
    queryKey: attachmentsKey(taskId),
    enabled: !!taskId,
  });

  return result;
}

export function useUploadAttachment(taskId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (file: File): Promise<Attachment> => {
      if (!taskId) throw new Error("No task");
      if (!user) throw new Error("Not signed in");

      // Path convention is `{task_id}/...` so the storage RLS policy can
      // extract the task ID from the first folder segment.
      const path = `${taskId}/${crypto.randomUUID()}`;

      const { error: uploadError } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .upload(path, file, {
          contentType: file.type || undefined,
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from("attachments")
        .insert({
          task_id: taskId,
          uploader_id: user.id,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || null,
          storage_path: path,
        })
        .select()
        .single();

      if (error) {
        // DB insert failed but the storage object exists — best-effort cleanup
        // so we don't leak orphans. Ignore the cleanup result; the original
        // error is what surfaces to the user.
        await supabase.storage.from(ATTACHMENTS_BUCKET).remove([path]);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: attachmentsKey(taskId) });
    },
    onError: () => {
      toast.error("Failed to upload attachment");
    },
  });
}

export function useDeleteAttachment(taskId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (attachment: Attachment): Promise<void> => {
      const { error } = await supabase
        .from("attachments")
        .delete()
        .eq("id", attachment.id);
      if (error) throw error;
      // DB is the source of truth; storage cleanup is best-effort. If it
      // fails we orphan a file but the UI is consistent.
      await supabase.storage.from(ATTACHMENTS_BUCKET).remove([attachment.storage_path]);
    },
    onMutate: async (attachment) => {
      await qc.cancelQueries({ queryKey: attachmentsKey(taskId) });
      const previous = qc.getQueryData<Attachment[]>(attachmentsKey(taskId));
      qc.setQueryData<Attachment[]>(attachmentsKey(taskId), (old = []) =>
        old.filter((a) => a.id !== attachment.id)
      );
      return { previous };
    },
    onError: (_err, _att, context) => {
      if (context?.previous) {
        qc.setQueryData(attachmentsKey(taskId), context.previous);
      }
      toast.error("Failed to delete attachment");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: attachmentsKey(taskId) });
    },
  });
}

/**
 * Bulk-delete every attachment on a task. RLS gates this to the uploader
 * (per row) OR the task creator (any row on their task) — see migration
 * 0012. Optimistically clears the cache; refetch on settle.
 */
export function useDeleteAllAttachments(taskId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (current: Attachment[]): Promise<void> => {
      if (!taskId || current.length === 0) return;
      const { error } = await supabase
        .from("attachments")
        .delete()
        .eq("task_id", taskId);
      if (error) throw error;
      const paths = current.map((a) => a.storage_path);
      // Best-effort storage cleanup; orphans here would still be hidden
      // from any UI because the DB rows are gone.
      await supabase.storage.from(ATTACHMENTS_BUCKET).remove(paths);
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: attachmentsKey(taskId) });
      const previous = qc.getQueryData<Attachment[]>(attachmentsKey(taskId));
      qc.setQueryData<Attachment[]>(attachmentsKey(taskId), []);
      return { previous };
    },
    onError: (_err, _v, context) => {
      if (context?.previous) {
        qc.setQueryData(attachmentsKey(taskId), context.previous);
      }
      toast.error("Failed to delete attachments");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: attachmentsKey(taskId) });
    },
  });
}

/**
 * Returns a short-lived signed URL for opening or downloading the file.
 * Pass `{ download: filename }` to force the browser to save instead of render
 * (sets Content-Disposition: attachment on the response).
 */
export async function getSignedAttachmentUrl(
  storagePath: string,
  options?: { download?: string }
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, 60, options);
  if (error) throw error;
  return data.signedUrl;
}

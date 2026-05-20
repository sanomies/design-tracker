import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import type { WorkspaceInvitation } from "@/types/database";

const invitationsKey = (workspaceId: string | undefined) =>
  ["invitations", workspaceId] as const;

export type InvitationPreview = {
  id: string;
  workspace_id: string;
  workspace_name: string;
  invited_email: string | null;
  role: "owner" | "member";
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
};

// Build the shareable URL the user copies and sends. BASE_URL is "/" in dev
// and "/design-tracker/" in the Pages deploy — strip the trailing slash so we
// don't emit a double-slash.
export function inviteUrl(token: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  if (typeof window === "undefined") return `${base}/invite/${token}`;
  return `${window.location.origin}${base}/invite/${token}`;
}

// List pending invitations for a workspace (excludes already-accepted).
export function useInvitations(workspaceId: string | undefined) {
  return useQuery({
    queryKey: invitationsKey(workspaceId),
    queryFn: async (): Promise<WorkspaceInvitation[]> => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("workspace_invitations")
        .select("*")
        .eq("workspace_id", workspaceId)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });
}

export function useCreateInvitation(workspaceId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { email?: string }): Promise<WorkspaceInvitation> => {
      if (!workspaceId) throw new Error("No workspace");
      if (!user) throw new Error("Not signed in");
      // Two concatenated UUIDs ≈ 256 bits of entropy. Unguessable.
      const token = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
      const { data, error } = await supabase
        .from("workspace_invitations")
        .insert({
          workspace_id: workspaceId,
          invited_email: input.email?.trim() || null,
          token,
          role: "member",
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: invitationsKey(workspaceId) });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create invitation");
    },
  });
}

export function useDeleteInvitation(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string): Promise<void> => {
      const { error } = await supabase
        .from("workspace_invitations")
        .delete()
        .eq("id", invitationId);
      if (error) throw error;
    },
    onMutate: async (invitationId) => {
      await qc.cancelQueries({ queryKey: invitationsKey(workspaceId) });
      const previous = qc.getQueryData<WorkspaceInvitation[]>(invitationsKey(workspaceId));
      qc.setQueryData<WorkspaceInvitation[]>(invitationsKey(workspaceId), (old = []) =>
        old.filter((i) => i.id !== invitationId)
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        qc.setQueryData(invitationsKey(workspaceId), context.previous);
      }
      toast.error("Failed to revoke invitation");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: invitationsKey(workspaceId) });
    },
  });
}

// Looks up an invitation by token via a SECURITY DEFINER RPC. Works even if
// the caller isn't a workspace member (because they're about to become one).
export function useInvitationByToken(token: string | undefined) {
  return useQuery({
    queryKey: ["invitation-by-token", token],
    queryFn: async (): Promise<InvitationPreview | null> => {
      if (!token) return null;
      const { data, error } = await supabase.rpc("invitation_by_token", { _token: token });
      if (error) throw error;
      return (data?.[0] as InvitationPreview | undefined) ?? null;
    },
    enabled: !!token,
    retry: false,
  });
}

export function useAcceptInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (token: string): Promise<string> => {
      const { data, error } = await supabase.rpc("accept_invitation", { _token: token });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      // Cache invalidations: the user's workspace list, their membership,
      // and any per-workspace data should refetch.
      void qc.invalidateQueries({ queryKey: ["workspaces"] });
      void qc.invalidateQueries({ queryKey: ["workspace-members"] });
      void qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

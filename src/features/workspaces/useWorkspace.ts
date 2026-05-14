import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import type { Workspace } from "@/types/database";

import { useCurrentWorkspaceId } from "./CurrentWorkspaceProvider";

// Fetches every workspace the user is a member of, oldest first. RLS already
// gates this to membership, so we can just select all rows.
async function fetchWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export function useWorkspaces() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["workspaces", user?.id],
    queryFn: fetchWorkspaces,
    enabled: !!user,
  });
}

// Returns the *current* workspace — the one the user has selected via the
// switcher, or the oldest one as a default fallback. Falls back gracefully
// if the saved id no longer exists (e.g., the workspace was deleted).
export function useWorkspace() {
  const { data: workspaces, isLoading } = useWorkspaces();
  const { currentWorkspaceId } = useCurrentWorkspaceId();

  const data =
    workspaces?.find((w) => w.id === currentWorkspaceId) ??
    workspaces?.[0] ??
    null;

  return { data, isLoading };
}

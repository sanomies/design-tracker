import { useQuery } from "@tanstack/react-query";

import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/database";

// Two-step fetch: workspace_members → profiles. Embedded selects work but
// require type assertions against our hand-written Database type; two
// explicit queries stay strongly typed and the round trips are negligible
// for the assignee dropdown.
async function fetchWorkspaceMembers(workspaceId: string): Promise<Profile[]> {
  const { data: members, error: membersError } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId);
  if (membersError) throw membersError;
  if (members.length === 0) return [];

  const ids = members.map((m) => m.user_id);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("*")
    .in("id", ids);
  if (profilesError) throw profilesError;
  return profiles;
}

export function useWorkspaceMembers(workspaceId: string | undefined) {
  const result = useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => fetchWorkspaceMembers(workspaceId!),
    enabled: !!workspaceId,
  });

  // Live-update the assignee dropdown / mention popup when someone joins or
  // leaves the workspace.
  useRealtimeInvalidate({
    table: "workspace_members",
    filter: workspaceId ? `workspace_id=eq.${workspaceId}` : undefined,
    queryKey: ["workspace-members", workspaceId],
    enabled: !!workspaceId,
  });

  return result;
}

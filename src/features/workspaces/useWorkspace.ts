import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import type { Workspace } from "@/types/database";

// Fetches the user's default (oldest) workspace. The signup trigger creates
// one automatically, so this should always resolve for an authed user.
async function fetchDefaultWorkspace(): Promise<Workspace | null> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function useWorkspace() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["workspace", "default", user?.id],
    queryFn: fetchDefaultWorkspace,
    enabled: !!user,
  });
}

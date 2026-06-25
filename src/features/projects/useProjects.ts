import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/AuthProvider";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { supabase } from "@/lib/supabase";
import type { Project } from "@/types/database";

const projectsKey = (workspaceId: string | undefined) => ["projects", workspaceId] as const;

// Reads -----------------------------------------------------------------

export function useProjects(workspaceId: string | undefined) {
  const result = useQuery({
    queryKey: projectsKey(workspaceId),
    queryFn: async (): Promise<Project[]> => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("workspace_id", workspaceId)
        // Server-side ordering is by created_at only. Sidebar order
        // (which follows the user-set drag position) is applied
        // client-side below so a not-yet-applied 0020 migration —
        // where the `position` column doesn't exist — can't break
        // the query and empty out the sidebar.
        .order("created_at", { ascending: true });
      if (error) throw error;
      return [...data].sort((a, b) => {
        const pa = (a as { position?: number }).position ?? 0;
        const pb = (b as { position?: number }).position ?? 0;
        return pa - pb;
      });
    },
    enabled: !!workspaceId,
  });

  useRealtimeInvalidate({
    table: "projects",
    filter: workspaceId ? `workspace_id=eq.${workspaceId}` : undefined,
    queryKey: projectsKey(workspaceId),
    enabled: !!workspaceId,
  });

  return result;
}

// Single-project fetch — used by surfaces (like the inbox) that need to
// resolve a project's workspace from a task's project_id without knowing
// which workspace ahead of time.
export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: async (): Promise<Project | null> => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
}

// Create ----------------------------------------------------------------

type CreateInput = { name: string; color: string; kind: Project["kind"] };

export function useCreateProject(workspaceId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (values: CreateInput): Promise<Project> => {
      if (!workspaceId) throw new Error("No workspace");
      // Date.now() keeps new projects at the bottom of the sidebar.
      // Drag-reorder later interpolates between neighbour positions.
      const position = Date.now();
      const { data, error } = await supabase
        .from("projects")
        .insert({
          workspace_id: workspaceId,
          name: values.name,
          color: values.color,
          kind: values.kind,
          position,
        })
        .select()
        .single();
      if (error) throw error;

      // Seed every brand-new project with an "Unassigned" section so the
      // first task lands somewhere meaningful instead of in the headerless
      // bucket. Treated as best-effort — if it fails the project is still
      // valid and the user can create sections manually.
      const { error: sectionError } = await supabase.from("sections").insert({
        project_id: data.id,
        name: "Unassigned",
        position: Date.now(),
        created_by: user?.id ?? null,
      });
      if (sectionError) {
        console.error("Failed to seed default Unassigned section", sectionError);
      }

      return data;
    },
    onMutate: async (values) => {
      await qc.cancelQueries({ queryKey: projectsKey(workspaceId) });
      const previous = qc.getQueryData<Project[]>(projectsKey(workspaceId));
      const optimistic: Project = {
        id: `temp-${crypto.randomUUID()}`,
        workspace_id: workspaceId ?? "",
        name: values.name,
        color: values.color,
        position: Date.now(),
        archived: false,
        kind: values.kind,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<Project[]>(projectsKey(workspaceId), (old = []) => [...old, optimistic]);
      return { previous };
    },
    onError: (_err, _values, context) => {
      if (context?.previous) {
        qc.setQueryData(projectsKey(workspaceId), context.previous);
      }
      toast.error("Failed to create project");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: projectsKey(workspaceId) });
    },
  });
}

// Update ----------------------------------------------------------------

type UpdateInput = {
  id: string;
  patch: { name?: string; color?: string; archived?: boolean; kind?: Project["kind"] };
};

/**
 * General-purpose project patch — used by the Edit Project dialog to
 * change name and/or color in a single round-trip. The optimistic
 * cache update merges the patch onto the existing row so the sidebar
 * + headers re-render immediately.
 */
export function useUpdateProject(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: UpdateInput): Promise<Project> => {
      const { data, error } = await supabase
        .from("projects")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: projectsKey(workspaceId) });
      const previous = qc.getQueryData<Project[]>(projectsKey(workspaceId));
      qc.setQueryData<Project[]>(projectsKey(workspaceId), (old = []) =>
        old.map((p) => (p.id === id ? { ...p, ...patch } : p))
      );
      return { previous };
    },
    onError: (_err, _values, context) => {
      if (context?.previous) {
        qc.setQueryData(projectsKey(workspaceId), context.previous);
      }
      toast.error("Failed to update project");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: projectsKey(workspaceId) });
    },
  });
}

// Reorder ---------------------------------------------------------------
//
// Drag-end in the sidebar fires this with the dragged project's id and
// the new floating-point position. The Sidebar component computes the
// midpoint of the neighbours' positions, same pattern as sections.

export function useReorderProject(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      position,
    }: {
      id: string;
      position: number;
    }): Promise<void> => {
      const { error } = await supabase
        .from("projects")
        .update({ position })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, position }) => {
      await qc.cancelQueries({ queryKey: projectsKey(workspaceId) });
      const previous = qc.getQueryData<Project[]>(projectsKey(workspaceId));
      // Patch the dragged row's position AND re-sort the array. The
      // sort is the load-bearing part: SortableContext reads its order
      // from the rendered items array, so without a re-sort here the
      // row snaps back to its original slot the moment dnd-kit removes
      // its drag transforms (flashing the whole list).
      qc.setQueryData<Project[]>(projectsKey(workspaceId), (old = []) => {
        const patched = old.map((p) => (p.id === id ? { ...p, position } : p));
        return [...patched].sort(
          (a, b) => (a.position ?? 0) - (b.position ?? 0)
        );
      });
      return { previous };
    },
    onError: (_err, _values, context) => {
      if (context?.previous) {
        qc.setQueryData(projectsKey(workspaceId), context.previous);
      }
      toast.error("Failed to reorder project");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: projectsKey(workspaceId) });
    },
  });
}

// Delete ----------------------------------------------------------------

export function useDeleteProject(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: projectsKey(workspaceId) });
      const previous = qc.getQueryData<Project[]>(projectsKey(workspaceId));
      qc.setQueryData<Project[]>(projectsKey(workspaceId), (old = []) =>
        old.filter((p) => p.id !== id)
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        qc.setQueryData(projectsKey(workspaceId), context.previous);
      }
      toast.error("Failed to delete project");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: projectsKey(workspaceId) });
    },
  });
}

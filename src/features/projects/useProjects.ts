import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import type { Project } from "@/types/database";

const projectsKey = (workspaceId: string | undefined) => ["projects", workspaceId] as const;

// Reads -----------------------------------------------------------------

export function useProjects(workspaceId: string | undefined) {
  return useQuery({
    queryKey: projectsKey(workspaceId),
    queryFn: async (): Promise<Project[]> => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });
}

// Create ----------------------------------------------------------------

type CreateInput = { name: string; color: string };

export function useCreateProject(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: CreateInput): Promise<Project> => {
      if (!workspaceId) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("projects")
        .insert({ workspace_id: workspaceId, name: values.name, color: values.color })
        .select()
        .single();
      if (error) throw error;
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

// Rename ----------------------------------------------------------------

type RenameInput = { id: string; name: string };

export function useRenameProject(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: RenameInput): Promise<Project> => {
      const { data, error } = await supabase
        .from("projects")
        .update({ name })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, name }) => {
      await qc.cancelQueries({ queryKey: projectsKey(workspaceId) });
      const previous = qc.getQueryData<Project[]>(projectsKey(workspaceId));
      qc.setQueryData<Project[]>(projectsKey(workspaceId), (old = []) =>
        old.map((p) => (p.id === id ? { ...p, name } : p))
      );
      return { previous };
    },
    onError: (_err, _values, context) => {
      if (context?.previous) {
        qc.setQueryData(projectsKey(workspaceId), context.previous);
      }
      toast.error("Failed to rename project");
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

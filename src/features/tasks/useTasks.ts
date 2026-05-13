import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import type { Task, TaskUpdate } from "@/types/database";

const tasksKey = (projectId: string | undefined) => ["tasks", projectId] as const;

// Reads -----------------------------------------------------------------

export function useTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: tasksKey(projectId),
    queryFn: async (): Promise<Task[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .is("parent_task_id", null) // v1: top-level tasks only
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
}

// Create ----------------------------------------------------------------

type CreateInput = { title: string };

export function useCreateTask(projectId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ title }: CreateInput): Promise<Task> => {
      if (!projectId) throw new Error("No project");
      // Date.now() as position keeps new tasks at the bottom and leaves
      // room between values for future drag-reordering.
      const position = Date.now();
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          project_id: projectId,
          title,
          position,
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ title }) => {
      await qc.cancelQueries({ queryKey: tasksKey(projectId) });
      const previous = qc.getQueryData<Task[]>(tasksKey(projectId));
      const optimistic: Task = {
        id: `temp-${crypto.randomUUID()}`,
        project_id: projectId ?? "",
        parent_task_id: null,
        title,
        description: null,
        assignee_id: null,
        due_date: null,
        status: "todo",
        priority: null,
        position: Date.now(),
        created_at: new Date().toISOString(),
        created_by: user?.id ?? null,
      };
      qc.setQueryData<Task[]>(tasksKey(projectId), (old = []) => [...old, optimistic]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(tasksKey(projectId), context.previous);
      }
      toast.error("Failed to create task");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: tasksKey(projectId) });
    },
  });
}

// Update ----------------------------------------------------------------

type UpdateInput = { id: string; patch: TaskUpdate };

export function useUpdateTask(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: UpdateInput): Promise<Task> => {
      const { data, error } = await supabase
        .from("tasks")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: tasksKey(projectId) });
      const previous = qc.getQueryData<Task[]>(tasksKey(projectId));
      qc.setQueryData<Task[]>(tasksKey(projectId), (old = []) =>
        old.map((t) => (t.id === id ? { ...t, ...patch } : t))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(tasksKey(projectId), context.previous);
      }
      toast.error("Failed to update task");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: tasksKey(projectId) });
    },
  });
}

// Delete ----------------------------------------------------------------

export function useDeleteTask(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: tasksKey(projectId) });
      const previous = qc.getQueryData<Task[]>(tasksKey(projectId));
      qc.setQueryData<Task[]>(tasksKey(projectId), (old = []) => old.filter((t) => t.id !== id));
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        qc.setQueryData(tasksKey(projectId), context.previous);
      }
      toast.error("Failed to delete task");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: tasksKey(projectId) });
    },
  });
}

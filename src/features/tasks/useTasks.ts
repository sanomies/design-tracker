import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/AuthProvider";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { supabase } from "@/lib/supabase";
import type { Task, TaskUpdate } from "@/types/database";

const UNDO_WINDOW_MS = 6000;

const tasksKey = (projectId: string | undefined) => ["tasks", projectId] as const;

// Reads -----------------------------------------------------------------

export function useTasks(projectId: string | undefined) {
  const result = useQuery({
    queryKey: tasksKey(projectId),
    queryFn: async (): Promise<Task[]> => {
      if (!projectId) return [];
      // Returns the full task tree for this project (top-level + subtasks).
      // Components filter and group as needed: TaskList shows top-level
      // (`parent_task_id IS NULL`); SubtaskList filters by parent.
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  useRealtimeInvalidate({
    table: "tasks",
    filter: projectId ? `project_id=eq.${projectId}` : undefined,
    queryKey: tasksKey(projectId),
    enabled: !!projectId,
  });

  return result;
}

// Create ----------------------------------------------------------------

type CreateInput = {
  title: string;
  parentTaskId?: string | null;
  sectionId?: string | null;
};

export function useCreateTask(projectId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      title,
      parentTaskId,
      sectionId,
    }: CreateInput): Promise<Task> => {
      if (!projectId) throw new Error("No project");
      // Date.now() as position keeps new tasks at the bottom and leaves
      // room between values for future drag-reordering.
      const position = Date.now();
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          project_id: projectId,
          section_id: sectionId ?? null,
          parent_task_id: parentTaskId ?? null,
          title,
          position,
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ title, parentTaskId, sectionId }) => {
      await qc.cancelQueries({ queryKey: tasksKey(projectId) });
      const previous = qc.getQueryData<Task[]>(tasksKey(projectId));
      const optimistic: Task = {
        id: `temp-${crypto.randomUUID()}`,
        project_id: projectId ?? "",
        section_id: sectionId ?? null,
        parent_task_id: parentTaskId ?? null,
        title,
        description: null,
        assignee_id: null,
        due_date: null,
        status: "todo",
        priority: null,
        position: Date.now(),
        created_at: new Date().toISOString(),
        created_by: user?.id ?? null,
        completed_at: null,
        my_section_id: null,
        my_position: null,
        publication: null,
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

// Undoable helpers ------------------------------------------------------
//
// These wrap the existing mutations with a "show toast with Undo for N
// seconds" interaction. Deletes are *deferred* (the DB call doesn't fire
// until the undo window closes) so undoing is a pure cache restore —
// cascaded deletes of comments/attachments/subtasks never happened.
// Renames hit the DB immediately; the undo path just fires the rename
// in reverse.

export function useUndoableDeleteTask(projectId: string | undefined) {
  const qc = useQueryClient();
  const deleteTask = useDeleteTask(projectId);
  const timersRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      timers.clear();
    };
  }, []);

  return (task: Task) => {
    const key = tasksKey(projectId);
    const previous = qc.getQueryData<Task[]>(key);
    // Optimistically hide the task immediately. The undo path swaps the
    // full previous snapshot back in; the commit path runs the real
    // delete (which then re-applies its own optimistic removal).
    qc.setQueryData<Task[]>(key, (old = []) => old.filter((t) => t.id !== task.id));

    let undone = false;
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer);
      if (!undone) deleteTask.mutate(task.id);
    }, UNDO_WINDOW_MS);
    timersRef.current.add(timer);

    const label = task.title?.trim() || "Untitled task";
    toast.success(`Deleted “${label}”`, {
      duration: UNDO_WINDOW_MS,
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          window.clearTimeout(timer);
          timersRef.current.delete(timer);
          if (previous) qc.setQueryData(key, previous);
        },
      },
    });
  };
}

export function useUndoableRenameTask(projectId: string | undefined) {
  const updateTask = useUpdateTask(projectId);

  return (task: Task, nextTitle: string) => {
    const previous = task.title;
    const trimmed = nextTitle.trim();
    if (!trimmed || trimmed === previous) return;

    updateTask.mutate({ id: task.id, patch: { title: trimmed } });
    toast.success("Renamed task", {
      duration: UNDO_WINDOW_MS,
      action: {
        label: "Undo",
        onClick: () => {
          updateTask.mutate({ id: task.id, patch: { title: previous } });
        },
      },
    });
  };
}

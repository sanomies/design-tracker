import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/AuthProvider";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { supabase } from "@/lib/supabase";
import type { MyTaskSection } from "@/types/database";

const mySectionsKey = (userId: string | undefined) =>
  ["my-task-sections", userId] as const;

const UNDO_WINDOW_MS = 6000;

export function useMySections() {
  const { user } = useAuth();
  const userId = user?.id;

  const result = useQuery({
    queryKey: mySectionsKey(userId),
    queryFn: async (): Promise<MyTaskSection[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("my_task_sections")
        .select("*")
        .eq("user_id", userId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  useRealtimeInvalidate({
    table: "my_task_sections",
    filter: userId ? `user_id=eq.${userId}` : undefined,
    queryKey: mySectionsKey(userId),
    enabled: !!userId,
  });

  return result;
}

export function useCreateMySection() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  return useMutation({
    mutationFn: async (name: string): Promise<MyTaskSection> => {
      if (!userId) throw new Error("No user");
      const position = Date.now();
      const { data, error } = await supabase
        .from("my_task_sections")
        .insert({ user_id: userId, name, position })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async (name) => {
      await qc.cancelQueries({ queryKey: mySectionsKey(userId) });
      const previous = qc.getQueryData<MyTaskSection[]>(mySectionsKey(userId));
      const optimistic: MyTaskSection = {
        id: `temp-${crypto.randomUUID()}`,
        user_id: userId ?? "",
        name,
        position: Date.now(),
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<MyTaskSection[]>(mySectionsKey(userId), (old = []) => [
        ...old,
        optimistic,
      ]);
      return { previous };
    },
    onError: (_err, _name, context) => {
      if (context?.previous) {
        qc.setQueryData(mySectionsKey(userId), context.previous);
      }
      toast.error("Failed to create section");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: mySectionsKey(userId) });
    },
  });
}

export function useRenameMySection() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }): Promise<MyTaskSection> => {
      const { data, error } = await supabase
        .from("my_task_sections")
        .update({ name })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, name }) => {
      await qc.cancelQueries({ queryKey: mySectionsKey(userId) });
      const previous = qc.getQueryData<MyTaskSection[]>(mySectionsKey(userId));
      qc.setQueryData<MyTaskSection[]>(mySectionsKey(userId), (old = []) =>
        old.map((s) => (s.id === id ? { ...s, name } : s))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(mySectionsKey(userId), context.previous);
      }
      toast.error("Failed to rename section");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: mySectionsKey(userId) });
    },
  });
}

export function useReorderMySection() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  return useMutation({
    mutationFn: async ({ id, position }: { id: string; position: number }): Promise<void> => {
      const { error } = await supabase
        .from("my_task_sections")
        .update({ position })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, position }) => {
      await qc.cancelQueries({ queryKey: mySectionsKey(userId) });
      const previous = qc.getQueryData<MyTaskSection[]>(mySectionsKey(userId));
      qc.setQueryData<MyTaskSection[]>(mySectionsKey(userId), (old = []) =>
        old.map((s) => (s.id === id ? { ...s, position } : s))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(mySectionsKey(userId), context.previous);
      }
      toast.error("Failed to reorder section");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: mySectionsKey(userId) });
    },
  });
}

export function useDeleteMySection() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("my_task_sections").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: mySectionsKey(userId) });
      const previous = qc.getQueryData<MyTaskSection[]>(mySectionsKey(userId));
      qc.setQueryData<MyTaskSection[]>(mySectionsKey(userId), (old = []) =>
        old.filter((s) => s.id !== id)
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        qc.setQueryData(mySectionsKey(userId), context.previous);
      }
      toast.error("Failed to delete section");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: mySectionsKey(userId) });
      // Tasks that lived in this section have my_section_id reset to NULL
      // by the FK's ON DELETE SET NULL — refresh the my-tasks cache so they
      // show up in the unsectioned bucket immediately.
      void qc.invalidateQueries({ queryKey: ["my-tasks"] });
    },
  });
}

// Undoable helpers ------------------------------------------------------
//
// Mirror the project-section undo pattern from useSections: deletes are
// deferred (DB call held back for 6s so undo is a pure cache restore),
// renames are immediate with reverse-apply on undo.

export function useUndoableDeleteMySection() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  const deleteSection = useDeleteMySection();
  const timersRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      timers.clear();
    };
  }, []);

  return (section: MyTaskSection) => {
    const key = mySectionsKey(userId);
    const previous = qc.getQueryData<MyTaskSection[]>(key);
    qc.setQueryData<MyTaskSection[]>(key, (old = []) =>
      old.filter((s) => s.id !== section.id)
    );

    let undone = false;
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer);
      if (!undone) deleteSection.mutate(section.id);
    }, UNDO_WINDOW_MS);
    timersRef.current.add(timer);

    const label = section.name?.trim() || "Section";
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

export function useUndoableRenameMySection() {
  const renameSection = useRenameMySection();

  return (section: MyTaskSection, nextName: string) => {
    const previous = section.name;
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === previous) return;

    renameSection.mutate({ id: section.id, name: trimmed });
    toast.success("Renamed section", {
      duration: UNDO_WINDOW_MS,
      action: {
        label: "Undo",
        onClick: () => {
          renameSection.mutate({ id: section.id, name: previous });
        },
      },
    });
  };
}

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/AuthProvider";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { supabase } from "@/lib/supabase";
import type { Section } from "@/types/database";

const sectionsKey = (projectId: string | undefined) =>
  ["sections", projectId] as const;

const UNDO_WINDOW_MS = 6000;

export function useSections(projectId: string | undefined) {
  const result = useQuery({
    queryKey: sectionsKey(projectId),
    queryFn: async (): Promise<Section[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("sections")
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
    table: "sections",
    filter: projectId ? `project_id=eq.${projectId}` : undefined,
    queryKey: sectionsKey(projectId),
    enabled: !!projectId,
  });

  return result;
}

export function useCreateSection(projectId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (name: string): Promise<Section> => {
      if (!projectId) throw new Error("No project");
      // New sections go to the bottom — Date.now() is monotonic enough for
      // append-only ordering. Drag reorder lands in a follow-up.
      const position = Date.now();
      const { data, error } = await supabase
        .from("sections")
        .insert({
          project_id: projectId,
          name,
          position,
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async (name) => {
      await qc.cancelQueries({ queryKey: sectionsKey(projectId) });
      const previous = qc.getQueryData<Section[]>(sectionsKey(projectId));
      const optimistic: Section = {
        id: `temp-${crypto.randomUUID()}`,
        project_id: projectId ?? "",
        name,
        position: Date.now(),
        created_at: new Date().toISOString(),
        created_by: user?.id ?? null,
      };
      qc.setQueryData<Section[]>(sectionsKey(projectId), (old = []) => [
        ...old,
        optimistic,
      ]);
      return { previous };
    },
    onError: (_err, _name, context) => {
      if (context?.previous) {
        qc.setQueryData(sectionsKey(projectId), context.previous);
      }
      toast.error("Failed to create section");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: sectionsKey(projectId) });
    },
  });
}

export function useRenameSection(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }): Promise<Section> => {
      const { data, error } = await supabase
        .from("sections")
        .update({ name })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, name }) => {
      await qc.cancelQueries({ queryKey: sectionsKey(projectId) });
      const previous = qc.getQueryData<Section[]>(sectionsKey(projectId));
      qc.setQueryData<Section[]>(sectionsKey(projectId), (old = []) =>
        old.map((s) => (s.id === id ? { ...s, name } : s))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(sectionsKey(projectId), context.previous);
      }
      toast.error("Failed to rename section");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: sectionsKey(projectId) });
    },
  });
}

export function useReorderSection(projectId: string | undefined) {
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
        .from("sections")
        .update({ position })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, position }) => {
      // Optimistic write FIRST so it lands in the same synchronous
      // task as the caller's setState (e.g. setActiveId(null) on drop).
      // See useUpdateTask.onMutate for the full rationale.
      const previous = qc.getQueryData<Section[]>(sectionsKey(projectId));
      qc.setQueryData<Section[]>(sectionsKey(projectId), (old = []) =>
        old.map((s) => (s.id === id ? { ...s, position } : s))
      );
      await qc.cancelQueries({ queryKey: sectionsKey(projectId) });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(sectionsKey(projectId), context.previous);
      }
      toast.error("Failed to reorder section");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: sectionsKey(projectId) });
    },
  });
}

export function useDeleteSection(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("sections").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: sectionsKey(projectId) });
      const previous = qc.getQueryData<Section[]>(sectionsKey(projectId));
      qc.setQueryData<Section[]>(sectionsKey(projectId), (old = []) =>
        old.filter((s) => s.id !== id)
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        qc.setQueryData(sectionsKey(projectId), context.previous);
      }
      toast.error("Failed to delete section");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: sectionsKey(projectId) });
      // Tasks now have section_id = null (ON DELETE SET NULL); refresh them.
      void qc.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
  });
}

// Undoable helpers ------------------------------------------------------
//
// Same pattern as useTasks: deletes are deferred so undoing is a pure
// cache restore (no ON-DELETE-SET-NULL cascade fires until the window
// closes), renames hit the DB immediately and the undo path reverses
// them by re-applying the previous name.

export function useUndoableDeleteSection(projectId: string | undefined) {
  const qc = useQueryClient();
  const deleteSection = useDeleteSection(projectId);
  const timersRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      timers.clear();
    };
  }, []);

  return (section: Section) => {
    const key = sectionsKey(projectId);
    const previous = qc.getQueryData<Section[]>(key);
    qc.setQueryData<Section[]>(key, (old = []) =>
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

export function useUndoableRenameSection(projectId: string | undefined) {
  const renameSection = useRenameSection(projectId);

  return (section: Section, nextName: string) => {
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

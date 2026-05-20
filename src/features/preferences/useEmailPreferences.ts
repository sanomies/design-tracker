import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import type { EmailPreferences, EmailPreferencesUpdate } from "@/types/database";

const prefsKey = (userId: string | undefined) =>
  ["email-preferences", userId] as const;

export function useEmailPreferences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: prefsKey(user?.id),
    queryFn: async (): Promise<EmailPreferences | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("email_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (error) {
        // Row should exist (created by handle_new_user trigger). If it's
        // missing (older account, trigger ran before this migration), create
        // it lazily.
        if (error.code === "PGRST116") {
          const { data: inserted, error: insertErr } = await supabase
            .from("email_preferences")
            .insert({ user_id: user.id })
            .select()
            .single();
          if (insertErr) throw insertErr;
          return inserted as EmailPreferences;
        }
        throw error;
      }
      return data as EmailPreferences;
    },
    enabled: !!user,
  });
}

export function useUpdateEmailPreferences() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (patch: EmailPreferencesUpdate): Promise<EmailPreferences> => {
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("email_preferences")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .select()
        .single();
      if (error) throw error;
      return data as EmailPreferences;
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: prefsKey(user?.id) });
      const prev = qc.getQueryData<EmailPreferences>(prefsKey(user?.id));
      if (prev) qc.setQueryData(prefsKey(user?.id), { ...prev, ...patch });
      return { prev };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.prev) qc.setQueryData(prefsKey(user?.id), ctx.prev);
      toast.error("Couldn't save preference");
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: prefsKey(user?.id) });
    },
  });
}

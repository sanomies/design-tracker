import { Mail } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useEmailPreferences,
  useUpdateEmailPreferences,
} from "@/features/preferences/useEmailPreferences";
import type { EmailPreferencesUpdate } from "@/types/database";

type Toggle = {
  key: keyof EmailPreferencesUpdate;
  label: string;
  description: string;
};

const TOGGLES: Toggle[] = [
  {
    key: "notify_assigned",
    label: "Task assigned to me",
    description: "Email when someone assigns a task to you.",
  },
  {
    key: "notify_mention",
    label: "Mentioned in a comment",
    description: "Email when someone @-mentions you in a comment or task description.",
  },
  {
    key: "notify_comment",
    label: "Replies on tasks I follow",
    description:
      "Email when someone comments on a task you created, are assigned to, or have already commented on.",
  },
  {
    key: "notify_invite",
    label: "Workspace invites",
    description: "Email the invite link when someone invites you to a workspace.",
  },
];

export default function EmailSettingsPage() {
  const { data: prefs, isLoading } = useEmailPreferences();
  const update = useUpdateEmailPreferences();

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-10">
      <div className="mb-8 flex items-center gap-3">
        <Mail className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">Email notifications</h1>
      </div>

      <p className="mb-8 text-sm text-muted-foreground">
        Choose which events should send you an email. Changes save automatically.
      </p>

      {isLoading || !prefs ? (
        <div className="space-y-3">
          {TOGGLES.map((t) => (
            <Skeleton key={t.key} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {TOGGLES.map((t) => {
            const checked = Boolean(prefs[t.key as keyof typeof prefs]);
            return (
              <li key={t.key} className="flex items-start gap-3 p-4">
                <Checkbox
                  id={String(t.key)}
                  checked={checked}
                  onCheckedChange={(next) =>
                    update.mutate({ [t.key]: Boolean(next) } as EmailPreferencesUpdate)
                  }
                  className="mt-1"
                />
                <label htmlFor={String(t.key)} className="flex-1 cursor-pointer select-none">
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

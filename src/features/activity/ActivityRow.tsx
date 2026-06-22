import { format, formatDistanceToNow, parseISO } from "date-fns";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarColor } from "@/lib/avatarColor";
import { cn } from "@/lib/utils";
import { authorName, initials } from "@/features/comments/people";
import type { Profile, TaskActivity } from "@/types/database";

const STATUS_LABEL: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};
const PRIORITY_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function fmtDate(v: unknown): string {
  const s = str(v);
  if (!s) return "";
  try {
    return format(parseISO(s), "d MMM yyyy");
  } catch {
    return s;
  }
}

/**
 * The verb phrase shown after the actor's name, e.g. "removed the due date".
 * Reads the trigger-written `data` payload; section/assignee names are snapshots
 * stored at change time so they survive renames/deletes.
 */
export function activityPhrase(activity: TaskActivity): string {
  const d = (activity.data ?? {}) as Record<string, unknown>;
  switch (activity.type) {
    case "created":
      return "created this task";
    case "title_changed": {
      const to = str(d.to);
      return to ? `renamed this task to “${to}”` : "changed the title";
    }
    case "description_changed":
      return "changed the description";
    case "due_date_changed": {
      const from = str(d.from);
      const to = str(d.to);
      if (!to) return "removed the due date";
      if (!from) return `set the due date to ${fmtDate(to)}`;
      return `changed the due date to ${fmtDate(to)}`;
    }
    case "status_changed": {
      const from = str(d.from);
      const to = str(d.to);
      if (to === "done") return "completed this task";
      if (from === "done") return "marked this task incomplete";
      return `changed the status to ${STATUS_LABEL[to ?? ""] ?? to ?? "—"}`;
    }
    case "section_moved": {
      const from = str(d.from_name);
      const to = str(d.to_name);
      if (from && to) return `moved this task from ${from} to ${to}`;
      if (to) return `moved this task to ${to}`;
      if (from) return `removed this task from ${from}`;
      return "moved this task";
    }
    case "assignee_changed": {
      const from = str(d.from_name);
      const to = str(d.to_name);
      if (!to) return "unassigned this task";
      if (!from) return `assigned this task to ${to}`;
      return `reassigned this task to ${to}`;
    }
    case "priority_changed": {
      const from = str(d.from);
      const to = str(d.to);
      if (!to) return "cleared the priority";
      if (!from) return `set the priority to ${PRIORITY_LABEL[to] ?? to}`;
      return `changed the priority to ${PRIORITY_LABEL[to] ?? to}`;
    }
    default:
      return "updated this task";
  }
}

/**
 * A single system-generated activity entry, styled to sit quietly between
 * comment rows in the task detail stream: small muted text, bold actor name,
 * relative timestamp — no body, reactions, or actions.
 */
export function ActivityRow({
  activity,
  members,
  selfId,
}: {
  activity: TaskActivity;
  members: Profile[];
  selfId: string | undefined;
}) {
  const actor = authorName(activity.actor_id, members, selfId);
  return (
    <li className="flex items-start gap-2 py-2 text-xs text-[#708597]">
      <Avatar className="h-6 w-6 shrink-0">
        <AvatarFallback className={cn("text-[10px]", avatarColor(activity.actor_id))}>
          {initials(actor)}
        </AvatarFallback>
      </Avatar>
      <p className="min-w-0 flex-1 leading-6">
        <span className="font-semibold text-foreground">{actor}</span>{" "}
        {activityPhrase(activity)}
        {" · "}
        <span className="whitespace-nowrap">
          {formatDistanceToNow(parseISO(activity.created_at), { addSuffix: true })}
        </span>
      </p>
    </li>
  );
}

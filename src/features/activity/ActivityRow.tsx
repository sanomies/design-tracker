import { type ReactNode } from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";

import { authorName } from "@/features/comments/people";
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

/** Emphasis for the property/value that changed. */
function b(node: ReactNode): ReactNode {
  return <span className="font-semibold text-foreground">{node}</span>;
}

/**
 * The verb phrase shown after the actor's name, e.g. "removed the due date",
 * with the changed property/value emphasized. Reads the trigger-written `data`
 * payload; section/assignee names are snapshots stored at change time so they
 * survive renames/deletes.
 */
export function activityPhrase(activity: TaskActivity): ReactNode {
  const d = (activity.data ?? {}) as Record<string, unknown>;
  switch (activity.type) {
    case "created":
      return "created this task";
    case "title_changed": {
      const to = str(d.to);
      return to ? <>renamed this task to “{b(to)}”</> : <>changed the {b("title")}</>;
    }
    case "description_changed":
      return <>changed the {b("description")}</>;
    case "due_date_changed": {
      const from = str(d.from);
      const to = str(d.to);
      if (!to) return <>removed the {b("due date")}</>;
      if (!from) return <>set the due date to {b(fmtDate(to))}</>;
      return <>changed the due date to {b(fmtDate(to))}</>;
    }
    case "status_changed": {
      const from = str(d.from);
      const to = str(d.to);
      if (to === "done") return <>{b("completed")} this task</>;
      if (from === "done") return <>marked this task {b("incomplete")}</>;
      return <>changed the status to {b(STATUS_LABEL[to ?? ""] ?? to ?? "—")}</>;
    }
    case "section_moved": {
      const from = str(d.from_name);
      const to = str(d.to_name);
      if (from && to) return <>moved this task from {b(from)} to {b(to)}</>;
      if (to) return <>moved this task to {b(to)}</>;
      if (from) return <>removed this task from {b(from)}</>;
      return "moved this task";
    }
    case "assignee_changed": {
      const from = str(d.from_name);
      const to = str(d.to_name);
      if (!to) return <>{b("unassigned")} this task</>;
      if (!from) return <>assigned this task to {b(to)}</>;
      return <>reassigned this task to {b(to)}</>;
    }
    case "priority_changed": {
      const from = str(d.from);
      const to = str(d.to);
      if (!to) return <>cleared the {b("priority")}</>;
      if (!from) return <>set the priority to {b(PRIORITY_LABEL[to] ?? to)}</>;
      return <>changed the priority to {b(PRIORITY_LABEL[to] ?? to)}</>;
    }
    default:
      return "updated this task";
  }
}

/**
 * A single system-generated activity entry, styled to sit quietly between
 * comment rows in the task detail stream: small muted text with the actor name
 * and changed property in bold — no avatar, body, reactions, or actions.
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
    <li className="py-2 text-xs leading-6 text-[#708597]">
      <span className="font-semibold text-foreground">{actor}</span>{" "}
      {activityPhrase(activity)}
      {" · "}
      <span className="whitespace-nowrap">
        {formatDistanceToNow(parseISO(activity.created_at), { addSuffix: true })}
      </span>
    </li>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { formatDistanceToNow, parseISO } from "date-fns";
import DOMPurify from "dompurify";
import {
  AtSign,
  Bell,
  CheckCircle2,
  MessageCircle,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";

import type { NotificationType } from "@/types/database";

import { IconSearch } from "@/components/icons/figma";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarColor } from "@/lib/avatarColor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveProjectColor } from "@/features/projects/colors";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useMarkNotificationUnread,
  useNotifications,
  type NotificationView,
} from "@/features/notifications/useNotifications";
import { useProject } from "@/features/projects/useProjects";
import { TaskDetailPanel } from "@/features/tasks/TaskDetailPanel";
import { useTasks } from "@/features/tasks/useTasks";
import { useResizablePanel } from "@/hooks/useResizablePanel";
import { cn } from "@/lib/utils";

export default function InboxPage() {
  const { data: notifications, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markUnread = useMarkNotificationUnread();
  const markAllRead = useMarkAllNotificationsRead();

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTaskId = searchParams.get("task");

  const selectedNotification =
    notifications?.find((n) => n.task_id === selectedTaskId) ?? null;
  const projectId = selectedNotification?.task?.project_id;

  const { data: project } = useProject(projectId);
  const { data: tasks } = useTasks(projectId);
  const selectedTask = tasks?.find((t) => t.id === selectedTaskId) ?? null;
  const panelOpen = selectedTask !== null;

  const { width: panelWidth, isResizing, onPointerDown } = useResizablePanel({
    defaultWidth: 600,
    min: 360,
    max: 1000,
  });

  const setSelectedTaskId = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("task", id);
    else next.delete("task");
    setSearchParams(next, { replace: true });
  };

  const closePanel = () => setSelectedTaskId(null);

  // Esc closes the panel — but defer to any open dialog/menu first.
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const blocking =
        document.querySelector('[role="dialog"][data-state="open"]') ||
        document.querySelector('[role="menu"][data-state="open"]') ||
        document.querySelector('[role="listbox"][data-state="open"]');
      if (blocking) return;
      closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen, searchParams]);

  // Local search — filters across actor name, task/workspace title, and
  // project name. Strictly client-side; the list is capped at 50 items
  // by the underlying query, so a naive `.includes` loop is fine.
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const list = notifications ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((n) => {
      const data = (n.data ?? {}) as { task_title?: string; workspace_name?: string };
      const title =
        n.task?.title ?? data.task_title ?? data.workspace_name ?? "";
      const actor = n.actor?.full_name ?? "";
      const projectName = n.task?.project?.name ?? "";
      return (
        title.toLowerCase().includes(q) ||
        actor.toLowerCase().includes(q) ||
        projectName.toLowerCase().includes(q)
      );
    });
  }, [notifications, query]);

  const onSelect = (n: NotificationView) => {
    if (!n.read_at) markRead.mutate(n.id);
    if (!n.task_id) return;
    setSelectedTaskId(n.task_id === selectedTaskId ? null : n.task_id);
  };

  const onToggleRead = (n: NotificationView) => {
    if (n.read_at) markUnread.mutate(n.id);
    else markRead.mutate(n.id);
  };

  const unreadCount = (notifications ?? []).filter((n) => !n.read_at).length;

  return (
    <div className="relative h-full flex">
      <section className="flex-1 min-w-0 flex flex-col">
        {/* Sticky header — matches the Figma's `border-b border-r p-[16px]`
            with the title on the left and a 400px search pill on the right.
            Mirrors ProjectView's header so the chrome reads as one family. */}
        <header className="shrink-0 bg-white border-b border-[#DEDFE0] p-4 flex items-center gap-3">
          <div className="flex items-center gap-2 py-2 flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Inbox</h1>
            {unreadCount > 0 && (
              <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-foreground px-1.5 text-[12px] font-bold text-background">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-[#708597] hover:text-foreground"
              onClick={() => markAllRead.mutate()}
            >
              Mark all read
            </Button>
          )}
          <InboxSearch value={query} onChange={setQuery} />
        </header>

        {/* Body — gray surface holding white rounded notification cards. */}
        <div className="flex-1 overflow-y-auto bg-[#EDF2F4] p-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-3/4 rounded-2xl" />
            </div>
          ) : !notifications || notifications.length === 0 ? (
            <EmptyInbox />
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-[#708597]">
              No notifications match “{query}”.
            </p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((n) => (
                <NotificationCard
                  key={n.id}
                  notification={n}
                  active={!!n.task_id && n.task_id === selectedTaskId}
                  onSelect={onSelect}
                  onToggleRead={onToggleRead}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      <aside
        aria-hidden={!panelOpen}
        style={{ width: panelOpen ? panelWidth : 0 }}
        className={cn(
          "relative shrink-0 overflow-hidden border-l bg-background",
          !isResizing && "transition-[width] duration-200 ease-out",
          panelOpen && "shadow-[-12px_0_28px_-16px_rgba(0,0,0,0.18)]"
        )}
      >
        <div style={{ width: panelWidth }} className="h-full">
          {selectedTask && (
            <TaskDetailPanel
              key={selectedTask.id}
              task={selectedTask}
              workspaceId={project?.workspace_id}
              onClose={closePanel}
            />
          )}
        </div>
      </aside>

      {panelOpen && (
        <button
          type="button"
          aria-label="Resize panel"
          onPointerDown={onPointerDown}
          style={{ right: panelWidth - 4 }}
          className={cn(
            "group absolute top-0 bottom-0 z-20 w-2 cursor-col-resize focus:outline-none",
            !isResizing && "transition-[right] duration-200 ease-out"
          )}
        >
          <span
            className={cn(
              "block h-full w-px mx-auto transition-colors",
              isResizing ? "bg-primary/60" : "bg-transparent group-hover:bg-primary/40"
            )}
          />
        </button>
      )}
    </div>
  );
}

// --- Subcomponents ----------------------------------------------------

function InboxSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative w-[360px] max-w-full shrink-0">
      <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-[#708597] pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search"
        className="h-10 pl-12 pr-9 text-sm rounded-full border-[#DEDFE0] bg-white placeholder:text-[#708597] focus-visible:ring-1 focus-visible:ring-offset-0"
        aria-label="Search inbox"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 inline-flex items-center justify-center rounded-full text-[#708597] hover:text-foreground hover:bg-[#EDF2F4]"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// Visual + copy mapping for each notification type. Centralised so adding a
// new type is a one-line change.
const TYPE_META: Record<
  NotificationType,
  { icon: typeof AtSign; verb: string }
> = {
  mention: { icon: AtSign, verb: "mentioned you in" },
  comment: { icon: MessageCircle, verb: "commented on" },
  assigned: { icon: UserPlus, verb: "assigned you to" },
  unassigned: { icon: UserMinus, verb: "unassigned you from" },
  completed: { icon: CheckCircle2, verb: "completed your task" },
  deleted: { icon: Trash2, verb: "deleted your task" },
  invite_accepted: { icon: UserCheck, verb: "joined" },
};

function NotificationCard({
  notification,
  active,
  onSelect,
  onToggleRead,
}: {
  notification: NotificationView;
  active: boolean;
  onSelect: (n: NotificationView) => void;
  onToggleRead: (n: NotificationView) => void;
}) {
  const actorName = notification.actor?.full_name ?? "Someone";
  const isUnread = !notification.read_at;

  const data = (notification.data ?? {}) as {
    task_title?: string;
    workspace_name?: string;
  };
  // Task-bound notifications get their title from the joined task; the
  // workspace-bound ones (invite_accepted) store the workspace name on
  // `data`. Falls back to "a task" only if all sources are missing.
  const title =
    notification.task?.title ?? data.task_title ?? data.workspace_name ?? "a task";

  const meta = TYPE_META[notification.type];
  const Icon = meta.icon;
  const verb = meta.verb;

  // Preview text under the title — comment body for comment/mention-in-
  // comment, task description for mention-in-description.
  const previewSource =
    notification.comment?.body ??
    (notification.type === "mention" ? notification.task?.description : null);
  const preview = previewSource ? previewText(previewSource) : null;

  // Project pill — only when the notification points at a task that
  // belongs to a project we know about.
  const project = notification.task?.project ?? null;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(notification)}
        className={cn(
          "group w-full text-left bg-white rounded-2xl p-4 flex items-start gap-4 transition-shadow",
          // Selected card gets a brand ring; unread gets a subtle one so
          // the card pops against the gray surface without competing with
          // the active state.
          active
            ? "ring-2 ring-foreground/30"
            : isUnread
              ? "ring-1 ring-foreground/10 hover:ring-foreground/20"
              : "hover:ring-1 hover:ring-foreground/10"
        )}
      >
        <div className="flex flex-1 min-w-0 gap-4 max-w-[800px] mx-auto w-full">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback
              className={cn(
                "text-xs font-bold",
                avatarColor(notification.actor?.id)
              )}
            >
              {initials(actorName)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0 space-y-1">
            {project && (
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: resolveProjectColor(project.color) }}
                  aria-hidden
                />
                <span className="text-xs font-medium text-foreground truncate">
                  {project.name}
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs">
              <Icon
                className="h-[18px] w-[18px] shrink-0 text-foreground"
                aria-hidden
              />
              <span className="font-semibold text-foreground truncate">
                {actorName}
              </span>
              <span className="font-semibold text-[#708597] truncate">
                {verb}
              </span>
            </div>

            <p className="text-lg font-semibold leading-snug truncate">
              {title}
            </p>

            {preview && (
              <p className="text-xs text-[#708597] line-clamp-2 whitespace-pre-line">
                {preview}
              </p>
            )}

            <p className="text-[10px] text-[#708597]">
              {formatDistanceToNow(parseISO(notification.created_at), {
                addSuffix: true,
              })}
            </p>
          </div>

          {/* Read/unread toggle dot. Solid when unread; outlined-on-hover
              when read so handled rows stay quiet. */}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onToggleRead(notification);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onToggleRead(notification);
              }
            }}
            className={cn(
              "mt-1 h-2.5 w-2.5 rounded-full shrink-0 cursor-pointer transition",
              isUnread
                ? "bg-[#3858F5] hover:bg-[#3858F5]/70"
                : "border border-[#708597]/40 hover:border-foreground opacity-0 group-hover:opacity-100"
            )}
            aria-label={isUnread ? "Mark as read" : "Mark as unread"}
            title={isUnread ? "Mark as read" : "Mark as unread"}
          />
        </div>
      </button>
    </li>
  );
}

function EmptyInbox() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12 gap-2">
      <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center">
        <Bell className="h-5 w-5 text-[#708597]" aria-hidden />
      </div>
      <p className="text-sm font-medium">You're all caught up.</p>
      <p className="text-xs text-[#708597] max-w-[260px]">
        New mentions, assignments, and comments on your tasks will show up here.
      </p>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Strip HTML to plain text for the inbox preview. DOMPurify with no allowed
// tags keeps the mention chip's "@Name" text (since that lives in a text
// node inside the span) but drops all markup.
function previewText(html: string, maxLen = 220): string {
  const text = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    KEEP_CONTENT: true,
  })
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

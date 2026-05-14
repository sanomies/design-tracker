import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { formatDistanceToNow, parseISO } from "date-fns";
import DOMPurify from "dompurify";
import {
  AtSign,
  Bell,
  CheckCircle2,
  MessageSquare,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
} from "lucide-react";

import type { NotificationType } from "@/types/database";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarColor } from "@/lib/avatarColor";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

  // Same persisted-width hook as ProjectView so the panel width preference
  // is shared across surfaces.
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

  const onSelect = (n: NotificationView) => {
    if (!n.read_at) markRead.mutate(n.id);
    // Only notifications that still have a live task can open the panel.
    // `deleted` and `invite_accepted` carry context in `data` and have no
    // task to navigate to.
    if (!n.task_id) return;
    // Toggle: clicking the same task's notification again closes the panel.
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
        <header className="border-b px-6 h-14 flex items-center justify-between shrink-0">
          <h1 className="text-base font-semibold">Inbox</h1>
          {unreadCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => markAllRead.mutate()}
            >
              Mark all read
            </Button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-3/4" />
            </div>
          ) : !notifications || notifications.length === 0 ? (
            <EmptyInbox />
          ) : (
            <ul>
              {notifications.map((n) => (
                <NotificationRow
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

      {/* Resize handle outside the aside so it can straddle the panel's
          outer-left edge without being clipped by overflow-hidden. */}
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

// Visual + copy mapping for each notification type. Keeping it in one place
// makes adding new types a one-line change.
const TYPE_META: Record<
  NotificationType,
  { icon: typeof AtSign; verb: string }
> = {
  mention: { icon: AtSign, verb: "mentioned you in" },
  comment: { icon: MessageSquare, verb: "commented on" },
  assigned: { icon: UserPlus, verb: "assigned you to" },
  unassigned: { icon: UserMinus, verb: "unassigned you from" },
  completed: { icon: CheckCircle2, verb: "completed your task" },
  deleted: { icon: Trash2, verb: "deleted your task" },
  invite_accepted: { icon: UserCheck, verb: "joined" },
};

function NotificationRow({
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

  // Title source depends on type — task-bound notifications join through
  // `task.title`; the typeless ones (deleted / invite_accepted) store the
  // relevant string in `data`.
  const data = (notification.data ?? {}) as {
    task_title?: string;
    workspace_name?: string;
  };
  const title =
    notification.task?.title ??
    data.task_title ??
    data.workspace_name ??
    "a task";

  const meta = TYPE_META[notification.type];
  const Icon = meta.icon;
  const verb = meta.verb;

  // Preview text under the task title: the comment body for comment/mention-
  // in-comment, or the task description for mention-in-description. Other
  // notification types don't have surrounding text worth showing.
  const previewSource =
    notification.comment?.body ??
    (notification.type === "mention" ? notification.task?.description : null);
  const preview = previewSource ? previewText(previewSource) : null;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(notification)}
        className={cn(
          "group w-full text-left flex items-start gap-3 px-6 py-3 border-b last:border-b-0 transition-colors",
          active
            ? "bg-accent"
            : isUnread
              ? "bg-primary/5 hover:bg-primary/10"
              : "hover:bg-muted/50"
        )}
      >
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className={cn("text-xs", avatarColor(notification.actor?.id))}>
            {initials(actorName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">
              <span className="font-medium text-foreground">{actorName}</span> {verb}
            </span>
          </div>
          <p className="text-sm font-medium truncate">{title}</p>
          {preview && (
            <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-line">
              {preview}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            {formatDistanceToNow(parseISO(notification.created_at), { addSuffix: true })}
          </p>
        </div>

        {/* Click-target toggle: unread state is always visible (solid dot);
            read state's outline circle reveals on hover so it doesn't
            visually clutter rows that don't need attention. */}
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
            "mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 cursor-pointer transition",
            isUnread
              ? "bg-primary hover:bg-primary/70"
              : "border border-muted-foreground/40 hover:border-foreground opacity-0 group-hover:opacity-100"
          )}
          aria-label={isUnread ? "Mark as read" : "Mark as unread"}
          title={isUnread ? "Mark as read" : "Mark as unread"}
        />
      </button>
    </li>
  );
}

function EmptyInbox() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12 gap-2">
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
        <Bell className="h-5 w-5 text-muted-foreground" aria-hidden />
      </div>
      <p className="text-sm font-medium">You're all caught up.</p>
      <p className="text-xs text-muted-foreground max-w-[260px]">
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

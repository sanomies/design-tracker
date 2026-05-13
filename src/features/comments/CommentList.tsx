import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isEmptyHTML, RichTextEditor } from "@/components/rich-text/RichTextEditor";
import { RichTextContent } from "@/components/rich-text/RichTextContent";
import { useAuth } from "@/features/auth/AuthProvider";
import { useWorkspaceMembers } from "@/features/workspaces/useWorkspaceMembers";
import type { Profile } from "@/types/database";

import { useComments, useCreateComment } from "./useComments";

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function authorName(authorId: string | null, members: Profile[], selfId: string | undefined): string {
  if (!authorId) return "Unknown";
  if (authorId === selfId) {
    const me = members.find((m) => m.id === authorId);
    return me?.full_name ?? "You";
  }
  return members.find((m) => m.id === authorId)?.full_name ?? "Unknown";
}

export function CommentList({
  taskId,
  workspaceId,
}: {
  taskId: string;
  workspaceId: string | undefined;
}) {
  const { user } = useAuth();
  const { data: members = [] } = useWorkspaceMembers(workspaceId);
  const { data: comments, isLoading } = useComments(taskId);
  const createComment = useCreateComment(taskId);

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Comments {comments && comments.length > 0 ? `(${comments.length})` : ""}
      </h3>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-3/4" />
        </div>
      ) : comments && comments.length > 0 ? (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="text-[10px]">
                  {initials(authorName(c.author_id, members, user?.id))}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium truncate">
                    {authorName(c.author_id, members, user?.id)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(parseISO(c.created_at), { addSuffix: true })}
                  </span>
                </div>
                <RichTextContent html={c.body} className="mt-0.5" />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No comments yet.</p>
      )}

      <Composer
        members={members}
        disabled={!user || createComment.isPending}
        onPost={async (html) => {
          await createComment.mutateAsync(html);
        }}
        // Reset whenever the task changes so we don't carry a draft across tasks.
        key={taskId}
      />
    </div>
  );
}

function Composer({
  members,
  disabled,
  onPost,
}: {
  members: Profile[];
  disabled: boolean;
  onPost: (html: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const valueRef = useRef(value);
  valueRef.current = value;

  const post = async () => {
    const html = valueRef.current;
    if (isEmptyHTML(html)) return;
    try {
      await onPost(html);
      setValue("");
    } catch {
      // Toast already fired.
    }
  };

  // Cmd/Ctrl+Enter submits. Plain Enter inserts a newline (TipTap default).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        const target = e.target as HTMLElement | null;
        // Only fire if focus is inside this composer's editor. We tag the
        // wrapper with data-composer so we can scope without a ref to PM.
        const inside = target?.closest("[data-composer='comments']");
        if (!inside) return;
        e.preventDefault();
        void post();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const empty = isEmptyHTML(value);

  return (
    <div data-composer="comments" className="space-y-2">
      <RichTextEditor
        value={value}
        onChange={setValue}
        members={members}
        placeholder="Write a comment… @ to mention"
        minHeight="60px"
      />
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          <kbd className="rounded border bg-muted px-1">⌘</kbd>
          <span className="mx-1">+</span>
          <kbd className="rounded border bg-muted px-1">Enter</kbd>
          <span className="ml-1">to post</span>
        </p>
        <Button size="sm" onClick={post} disabled={disabled || empty}>
          Post
        </Button>
      </div>
    </div>
  );
}

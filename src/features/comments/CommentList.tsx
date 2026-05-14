import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { toast } from "sonner";
import { Download, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarColor } from "@/lib/avatarColor";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { isEmptyHTML, RichTextEditor } from "@/components/rich-text/RichTextEditor";
import { RichTextContent } from "@/components/rich-text/RichTextContent";
import {
  deleteTaskImageObject,
  downloadImagesAsZip,
  extractFileUrls,
  extractImageUrls,
  removeImageFromHtml,
} from "@/components/rich-text/inlineImageUtils";
import {
  uploadEditorFile,
  uploadEditorImage,
} from "@/components/rich-text/uploadEditorImage";
import { useAuth } from "@/features/auth/AuthProvider";
import { useWorkspaceMembers } from "@/features/workspaces/useWorkspaceMembers";
import type { Comment, Profile } from "@/types/database";

import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useUpdateComment,
} from "./useComments";

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
  const updateComment = useUpdateComment(taskId);
  const deleteComment = useDeleteComment(taskId);

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
            <CommentRow
              key={c.id}
              comment={c}
              members={members}
              selfId={user?.id}
              taskId={taskId}
              onDeleteImage={async (src) => {
                const nextBody = removeImageFromHtml(c.body, src);
                await updateComment.mutateAsync({ commentId: c.id, body: nextBody });
                // Storage cleanup is best-effort — the comment update already
                // removed the visible reference.
                void deleteTaskImageObject(src);
              }}
              onEdit={async (commentId, body) => {
                await updateComment.mutateAsync({ commentId, body });
              }}
              onDelete={async (commentId) => {
                // Snapshot inline image URLs BEFORE the row is gone so we
                // can clean them out of storage after the row deletes
                // successfully. Best-effort — comment is the source of
                // truth, the orphaned blob is just wasted bytes.
                const imageUrls = extractImageUrls(c.body);
                await deleteComment.mutateAsync(commentId);
                for (const url of imageUrls) {
                  void deleteTaskImageObject(url);
                }
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No comments yet.</p>
      )}

      <Composer
        members={members}
        taskId={taskId}
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

function CommentRow({
  comment,
  members,
  selfId,
  taskId,
  onDeleteImage,
  onEdit,
  onDelete,
}: {
  comment: Comment;
  members: Profile[];
  selfId: string | undefined;
  taskId: string;
  onDeleteImage: (src: string) => Promise<void>;
  onEdit: (commentId: string, body: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
}) {
  const isAuthor = !!selfId && comment.author_id === selfId;
  const imageUrls = useMemo(() => extractImageUrls(comment.body), [comment.body]);
  const fileUrls = useMemo(() => extractFileUrls(comment.body), [comment.body]);
  const allUrls = useMemo(
    () => [...imageUrls, ...fileUrls],
    [imageUrls, fileUrls]
  );
  // Show the bulk-download menu when there are 2+ inline items to grab. Mix
  // of types switches the label from "images" to the generic "files".
  const hasMultipleItems = allUrls.length > 1;
  const hasMixedTypes = fileUrls.length > 0;
  const downloadLabel = hasMixedTypes ? "Download all files" : "Download all images";
  const zipBaseName = hasMixedTypes ? "comment-files" : "comment-images";
  const loadingLabel = hasMixedTypes ? "files" : "images";
  // Dropdown is shown to the author always (they get the Edit option) and
  // to non-authors only when there are multiple downloadable items.
  const showActionMenu = isAuthor || hasMultipleItems;

  // Two-step delete: clicking the trash icon arms a confirmation dialog,
  // and only an explicit confirm fires the actual removal. Avoids accidental
  // clobbering of an image the user can't easily recover.
  const [pendingDeleteSrc, setPendingDeleteSrc] = useState<string | null>(null);
  const handleDeleteImage = useCallback((src: string) => {
    setPendingDeleteSrc(src);
  }, []);
  const confirmDelete = () => {
    if (!pendingDeleteSrc) return;
    void onDeleteImage(pendingDeleteSrc);
    setPendingDeleteSrc(null);
  };

  // Confirmation for full-comment delete. Separate from the image delete
  // dialog so they can't fight over the same open state.
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const confirmDeleteComment = () => {
    void onDelete(comment.id);
    setConfirmDeleteOpen(false);
  };

  // Inline edit state. `editValue` is seeded from the comment body each time
  // the user enters edit mode so abandoned drafts don't leak between edits.
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const editValueRef = useRef(editValue);
  editValueRef.current = editValue;
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setEditValue(comment.body);
    setIsEditing(true);
  };
  const cancelEdit = () => {
    setIsEditing(false);
    setEditValue("");
  };
  const saveEdit = async () => {
    const next = editValueRef.current;
    if (isEmptyHTML(next)) return;
    if (next === comment.body) {
      setIsEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onEdit(comment.id, next);
      setIsEditing(false);
    } catch {
      // useUpdateComment already toasts on error; keep the editor open so
      // the user can retry instead of losing their changes.
    } finally {
      setSaving(false);
    }
  };

  // Cmd/Ctrl+Enter to save, Escape to cancel — scoped to this row's editor
  // via a data attribute so the post composer at the bottom keeps its own
  // shortcut handler.
  useEffect(() => {
    if (!isEditing) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inside = target?.closest(`[data-comment-edit="${comment.id}"]`);
      if (!inside) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void saveEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, comment.id]);

  const downloadAll = async () => {
    if (allUrls.length === 0) return;
    await toast.promise(
      downloadImagesAsZip(allUrls, `${zipBaseName}.zip`),
      {
        loading: `Packaging ${allUrls.length} ${loadingLabel}…`,
        success: "Download ready",
        error: "Failed to build the zip",
      }
    );
  };

  return (
    <li className="group/comment flex gap-2 rounded-md bg-white p-3 shadow-sm">
      <Avatar className="h-7 w-7 shrink-0">
        <AvatarFallback className={cn("text-[10px]", avatarColor(comment.author_id))}>
          {initials(authorName(comment.author_id, members, selfId))}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium truncate">
            {authorName(comment.author_id, members, selfId)}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(parseISO(comment.created_at), { addSuffix: true })}
          </span>
          {showActionMenu && !isEditing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 ml-auto opacity-0 group-hover/comment:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 transition-opacity"
                  aria-label="Comment actions"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isAuthor && (
                  <DropdownMenuItem onSelect={startEdit}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Edit comment
                  </DropdownMenuItem>
                )}
                {hasMultipleItems && (
                  <DropdownMenuItem onSelect={() => void downloadAll()}>
                    <Download className="mr-2 h-3.5 w-3.5" />
                    {downloadLabel}
                  </DropdownMenuItem>
                )}
                {isAuthor && (
                  <DropdownMenuItem
                    onSelect={() => setConfirmDeleteOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete comment
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {isEditing ? (
          <div data-comment-edit={comment.id} className="mt-1 space-y-2">
            <RichTextEditor
              value={editValue}
              onChange={setEditValue}
              members={members}
              placeholder="Edit comment…"
              minHeight="60px"
              autoFocus
              onUploadImage={(file) => uploadEditorImage(file, taskId)}
              onUploadFile={(file) => uploadEditorFile(file, taskId)}
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={cancelEdit}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void saveEdit()}
                disabled={
                  saving ||
                  isEmptyHTML(editValue) ||
                  editValue === comment.body
                }
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <RichTextContent
            html={comment.body}
            className="mt-0.5 comment-body"
            onDeleteImage={isAuthor ? handleDeleteImage : undefined}
          />
        )}
      </div>

      <AlertDialog
        open={!!pendingDeleteSrc}
        onOpenChange={(open) => !open && setPendingDeleteSrc(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this image?</AlertDialogTitle>
            <AlertDialogDescription>
              The image will be removed from this comment permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the comment
              {imageUrls.length > 0
                ? ` and ${imageUrls.length} attached image${imageUrls.length === 1 ? "" : "s"}.`
                : "."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteComment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete comment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

function Composer({
  members,
  taskId,
  disabled,
  onPost,
}: {
  members: Profile[];
  taskId: string;
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
        onUploadImage={(file) => uploadEditorImage(file, taskId)}
        onUploadFile={(file) => uploadEditorFile(file, taskId)}
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

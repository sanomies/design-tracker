import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { toast } from "sonner";
import { Download, Pencil, Trash2 } from "lucide-react";

import {
  IconMessageCircle,
  IconMoreHorizontal,
  IconSmilePlus,
} from "@/components/icons/figma";

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
import type { Comment, CommentReaction, Profile } from "@/types/database";

import { ReactionPicker } from "./ReactionPicker";
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useUpdateComment,
} from "./useComments";
import {
  useCommentReactions,
  useToggleCommentReaction,
} from "./useReactions";

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
  hideComposer = false,
}: {
  taskId: string;
  workspaceId: string | undefined;
  /** When true, render the comment list without the inline composer. Use
   *  when the composer is rendered elsewhere (e.g. as a sticky panel
   *  footer in TaskDetailPanel). */
  hideComposer?: boolean;
}) {
  const { user } = useAuth();
  const { data: members = [] } = useWorkspaceMembers(workspaceId);
  const { data: comments, isLoading } = useComments(taskId);
  const { data: reactions = [] } = useCommentReactions(taskId);
  const toggleReaction = useToggleCommentReaction(taskId);
  const updateComment = useUpdateComment(taskId);
  const deleteComment = useDeleteComment(taskId);

  // Pre-bucket reactions by comment_id so each CommentRow doesn't re-filter
  // the full array on every render.
  const reactionsByComment = new Map<string, CommentReaction[]>();
  for (const r of reactions) {
    const list = reactionsByComment.get(r.comment_id);
    if (list) list.push(r);
    else reactionsByComment.set(r.comment_id, [r]);
  }

  return (
    <div className="space-y-4">
      <h3 className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground">
        <IconMessageCircle className="h-[18px] w-[18px] text-foreground" />
        Comments
        {comments && comments.length > 0 && (
          <span
            className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-foreground px-1.5 text-[9px] font-bold text-background"
            aria-hidden
          >
            {comments.length}
          </span>
        )}
      </h3>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-3/4" />
        </div>
      ) : comments && comments.length > 0 ? (
        <ul className="divide-y divide-[#DEDFE0]">
          {comments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              members={members}
              selfId={user?.id}
              taskId={taskId}
              reactions={reactionsByComment.get(c.id) ?? []}
              onToggleReaction={(emoji) =>
                toggleReaction.mutate({ commentId: c.id, emoji })
              }
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

      {!hideComposer && (
        <CommentComposer
          taskId={taskId}
          workspaceId={workspaceId}
          // Reset whenever the task changes so we don't carry a draft across tasks.
          key={taskId}
        />
      )}
    </div>
  );
}

function CommentRow({
  comment,
  members,
  selfId,
  taskId,
  reactions,
  onToggleReaction,
  onDeleteImage,
  onEdit,
  onDelete,
}: {
  comment: Comment;
  members: Profile[];
  selfId: string | undefined;
  taskId: string;
  reactions: CommentReaction[];
  onToggleReaction: (emoji: string) => void;
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

  // Escape to cancel the inline edit. Save now goes through the visible
  // "Save" button only — keeps the interaction model uniform with the
  // sticky composer at the bottom, which also dropped Cmd+Enter.
  useEffect(() => {
    if (!isEditing) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inside = target?.closest(`[data-comment-edit="${comment.id}"]`);
      if (!inside) return;
      if (e.key === "Escape") {
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
    <li className="group/comment flex flex-col gap-2 py-2">
      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6 shrink-0">
          <AvatarFallback className={cn("text-[10px]", avatarColor(comment.author_id))}>
            {initials(authorName(comment.author_id, members, selfId))}
          </AvatarFallback>
        </Avatar>
        <span className="text-xs font-semibold truncate">
          {authorName(comment.author_id, members, selfId)}
        </span>
        <span className="text-xs text-[#708597]">
          {formatDistanceToNow(parseISO(comment.created_at), { addSuffix: true })}
        </span>
        {!isEditing && (
          <div className="ml-auto flex items-center gap-2">
            {/* Author/owner actions (edit/delete) and bulk download all live
                behind a separate MoreHorizontal trigger, only shown when
                there's something to put in it. Keeps the SmilePlus icon
                purely for reactions, matching the Figma. */}
            {showActionMenu && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-[#708597] hover:text-foreground opacity-0 group-hover/comment:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 transition-opacity"
                    aria-label="Comment actions"
                  >
                    <IconMoreHorizontal className="h-[18px] w-[18px]" />
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
            {/* SmilePlus = add emoji reaction. Always visible on hover for
                any project member; the picker writes via toggleReaction. */}
            <ReactionPicker
              onPick={(emoji) => onToggleReaction(emoji)}
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-[#708597] hover:text-foreground opacity-0 group-hover/comment:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 transition-opacity"
                  aria-label="Add reaction"
                >
                  <IconSmilePlus className="h-[18px] w-[18px]" />
                </Button>
              }
            />
          </div>
        )}
      </div>

      {isEditing ? (
        <div data-comment-edit={comment.id} className="pl-8 space-y-2">
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
        <div className="pl-8 space-y-2">
          <RichTextContent
            html={comment.body}
            className="text-xs comment-body"
            onDeleteImage={isAuthor ? handleDeleteImage : undefined}
          />
          <CommentReactions
            reactions={reactions}
            selfId={selfId}
            members={members}
            onToggle={onToggleReaction}
          />
        </div>
      )}

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

export function CommentComposer({
  taskId,
  workspaceId,
}: {
  taskId: string;
  workspaceId: string | undefined;
}) {
  const { user } = useAuth();
  const { data: members = [] } = useWorkspaceMembers(workspaceId);
  const createComment = useCreateComment(taskId);
  const disabled = !user || createComment.isPending;

  const [value, setValue] = useState("");
  const valueRef = useRef(value);
  valueRef.current = value;

  const post = async () => {
    const html = valueRef.current;
    if (isEmptyHTML(html)) return;
    try {
      await createComment.mutateAsync(html);
      setValue("");
    } catch {
      // Toast already fired.
    }
  };

  const empty = isEmptyHTML(value);

  // Identity for the leading avatar — mirrors Sidebar's user-card logic.
  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "You";
  const userInitials = initials(fullName);

  return (
    <div data-composer="comments" className="flex items-start gap-2">
      <Avatar className="h-6 w-6 shrink-0">
        <AvatarFallback className={cn("text-[10px]", avatarColor(user?.id))}>
          {userInitials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 space-y-2">
        <RichTextEditor
          value={value}
          onChange={setValue}
          members={members}
          placeholder="Add a comment"
          minHeight="32px"
          className="rounded-lg border-[#DEDFE0] shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.1)]"
          onUploadImage={(file) => uploadEditorImage(file, taskId)}
          onUploadFile={(file) => uploadEditorFile(file, taskId)}
        />
        {!empty && (
          <div className="flex items-center justify-end">
            <Button size="sm" onClick={post} disabled={disabled}>
              Post
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Pills at the bottom of a comment showing each distinct emoji and how
 * many people reacted with it. Clicking a pill toggles the current user's
 * own reaction on/off; the pill is outlined darker when the user is one
 * of the reactors. Tooltip lists the reactor names.
 */
function CommentReactions({
  reactions,
  selfId,
  members,
  onToggle,
}: {
  reactions: CommentReaction[];
  selfId: string | undefined;
  members: Profile[];
  onToggle: (emoji: string) => void;
}) {
  if (reactions.length === 0) return null;

  // Group reactions by emoji, preserving first-seen order so the pills
  // don't reshuffle as new reactions arrive.
  const groups = new Map<string, CommentReaction[]>();
  for (const r of reactions) {
    const list = groups.get(r.emoji);
    if (list) list.push(r);
    else groups.set(r.emoji, [r]);
  }

  const memberName = (id: string) =>
    id === selfId
      ? "You"
      : members.find((m) => m.id === id)?.full_name ?? "Someone";

  return (
    <div className="flex flex-wrap gap-1">
      {[...groups.entries()].map(([emoji, rows]) => {
        const mine = !!selfId && rows.some((r) => r.user_id === selfId);
        const tooltip = rows.map((r) => memberName(r.user_id)).join(", ");
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggle(emoji)}
            title={`${tooltip} reacted with ${emoji}`}
            className={cn(
              "h-6 inline-flex items-center gap-1 rounded border px-1.5 transition-colors",
              mine
                ? "border-foreground/40 bg-white"
                : "border-[#DEDFE0] bg-white hover:border-foreground/30"
            )}
            aria-pressed={mine}
            aria-label={`${rows.length} ${rows.length === 1 ? "reaction" : "reactions"} with ${emoji}. Click to toggle yours.`}
          >
            <span className="text-base leading-none">{emoji}</span>
            {rows.length > 1 && (
              <span className="text-[11px] font-medium text-[#708597]">
                {rows.length}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

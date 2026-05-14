import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  Download,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";

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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/AuthProvider";
import { cn } from "@/lib/utils";
import type { Attachment, Task } from "@/types/database";

import { AttachmentLightbox } from "./AttachmentLightbox";
import {
  FileTypeIcon,
  downloadAttachment,
  downloadAttachmentsAsZip,
  extensionLabel,
  isImageAttachment,
} from "./shared";
import {
  getSignedAttachmentUrl,
  MAX_ATTACHMENT_BYTES,
  useAttachments,
  useDeleteAllAttachments,
  useDeleteAttachment,
  useUploadAttachment,
} from "./useAttachments";

const TILE_W = 100;
const TILE_H = 60;

export function AttachmentList({ task }: { task: Task }) {
  const taskId = task.id;
  const { user } = useAuth();
  const { data: attachments, isLoading } = useAttachments(taskId);
  const upload = useUploadAttachment(taskId);
  const remove = useDeleteAttachment(taskId);
  const removeAll = useDeleteAllAttachments(taskId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDelete, setPendingDelete] = useState<Attachment | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const isTaskCreator = !!user && task.created_by === user.id;
  const hasAttachments = (attachments?.length ?? 0) > 0;

  const onPickFiles = () => fileInputRef.current?.click();

  const onFilesChosen = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`${file.name} is over the 50 MB limit`);
        return;
      }
      upload.mutate(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    remove.mutate(pendingDelete);
    setPendingDelete(null);
  };

  // Single file → direct download (preserves original filename + browser's
  // "save as" flow). Multiple → zip them in-browser so the user gets one
  // file with everything inside.
  const downloadAll = async () => {
    if (!attachments || attachments.length === 0) return;
    if (attachments.length === 1) {
      await downloadAttachment(attachments[0]!);
      return;
    }
    const zipName = `${zipFileName(task.title)}.zip`;
    await toast.promise(downloadAttachmentsAsZip(attachments, zipName), {
      loading: `Packaging ${attachments.length} files…`,
      success: "Download ready",
      error: "Failed to build the zip",
    });
  };

  const onConfirmDeleteAll = () => {
    if (!attachments) return;
    removeAll.mutate(attachments);
    setConfirmDeleteAll(false);
  };

  const count = attachments?.length ?? 0;

  return (
    <div className="space-y-2">
      <header className="flex items-center gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Attachments
        </h3>
        {count > 0 && (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-muted text-[11px] px-1.5">
            {count}
          </span>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 ml-1"
          aria-label="Add attachments"
          onClick={onPickFiles}
          disabled={upload.isPending}
        >
          {upload.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
        </Button>
        {hasAttachments && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                aria-label="More attachment actions"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void downloadAll()}>
                <Download className="mr-2 h-3.5 w-3.5" />
                Download all attachments
              </DropdownMenuItem>
              {isTaskCreator && (
                <DropdownMenuItem
                  onSelect={() => setConfirmDeleteAll(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete all attachments
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => onFilesChosen(e.target.files)}
        />
      </header>

      {isLoading ? (
        <div className="flex flex-wrap gap-2">
          <Skeleton style={{ width: TILE_W, height: TILE_H }} className="rounded-md" />
          <Skeleton style={{ width: TILE_W, height: TILE_H }} className="rounded-md" />
        </div>
      ) : (
        <div
          className={cn(
            "relative flex flex-wrap gap-2 rounded-md transition-colors",
            isDraggingOver && "ring-2 ring-primary/60 bg-primary/5"
          )}
          onDragEnter={(e) => {
            if (!hasFiles(e.dataTransfer)) return;
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragOver={(e) => {
            if (!hasFiles(e.dataTransfer)) return;
            e.preventDefault();
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
            setIsDraggingOver(false);
          }}
          onDrop={(e) => {
            if (!hasFiles(e.dataTransfer)) return;
            e.preventDefault();
            setIsDraggingOver(false);
            onFilesChosen(e.dataTransfer.files);
          }}
        >
          {attachments?.map((a) => (
            <AttachmentTile
              key={a.id}
              attachment={a}
              onOpen={() => setLightboxId(a.id)}
              onRequestDelete={() => setPendingDelete(a)}
            />
          ))}
          <AddTile onClick={onPickFiles} disabled={upload.isPending} pending={upload.isPending} />
          {isDraggingOver && (
            <div className="pointer-events-none absolute inset-0 rounded-md flex items-center justify-center text-xs font-medium text-primary">
              Drop files to upload
            </div>
          )}
        </div>
      )}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete attachment?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.file_name}” will be removed permanently.
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

      <AlertDialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all attachments?</AlertDialogTitle>
            <AlertDialogDescription>
              {count} attachment{count === 1 ? "" : "s"} will be removed
              permanently. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDeleteAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {lightboxId && attachments && attachments.length > 0 && (
        <AttachmentLightbox
          attachments={attachments}
          currentId={lightboxId}
          onCurrentIdChange={setLightboxId}
          onClose={() => setLightboxId(null)}
        />
      )}
    </div>
  );
}

// True when the drag carries at least one file. We can't read `.files`
// during dragenter/dragover (it's only populated on drop) so we sniff
// `items` instead.
function hasFiles(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  if (dt.items && dt.items.length > 0) {
    return Array.from(dt.items).some((item) => item.kind === "file");
  }
  return (dt.files?.length ?? 0) > 0;
}

// Strip filesystem-unfriendly characters from the task title so the
// resulting "<task>.zip" works across OSes. Falls back if the title is
// all-symbols.
function zipFileName(title: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned.length > 0 ? `${cleaned} — attachments` : "attachments";
}

function AttachmentTile({
  attachment,
  onOpen,
  onRequestDelete,
}: {
  attachment: Attachment;
  onOpen: () => void;
  onRequestDelete: () => void;
}) {
  const isImage = isImageAttachment(attachment);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [thumbFailed, setThumbFailed] = useState(false);

  useEffect(() => {
    if (!isImage) return;
    let cancelled = false;
    getSignedAttachmentUrl(attachment.storage_path)
      .then((url) => {
        if (!cancelled) setThumbUrl(url);
      })
      .catch(() => {
        if (!cancelled) setThumbFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attachment.storage_path, isImage]);

  const showImage = isImage && thumbUrl && !thumbFailed;
  const showImageLoading = isImage && !thumbUrl && !thumbFailed;

  return (
    <div className="group flex flex-col gap-1" style={{ width: TILE_W }}>
      <div
        className="relative rounded-md border bg-muted/40 overflow-hidden"
        style={{ width: TILE_W, height: TILE_H }}
      >
        {showImage ? (
          <button
            type="button"
            onClick={onOpen}
            className="absolute inset-0"
            aria-label={`Open ${attachment.file_name}`}
          >
            <img
              src={thumbUrl}
              alt=""
              className="w-full h-full object-contain"
              onError={() => setThumbFailed(true)}
              draggable={false}
            />
          </button>
        ) : showImageLoading ? (
          <div className="absolute inset-0 animate-pulse bg-muted" />
        ) : (
          <button
            type="button"
            onClick={onOpen}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2"
            aria-label={`Open ${attachment.file_name}`}
          >
            <FileTypeIcon mime={attachment.mime_type} size="lg" />
            <span className="text-[10px] uppercase text-muted-foreground tracking-wide">
              {extensionLabel(attachment.file_name, attachment.mime_type)}
            </span>
          </button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className={cn(
                "absolute top-1 right-1 h-6 w-6 shadow-sm",
                showImage
                  ? "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 transition-opacity"
                  : "opacity-90"
              )}
              aria-label={`Actions for ${attachment.file_name}`}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void downloadAttachment(attachment)}>
              <Download className="mr-2 h-3.5 w-3.5" />
              Download attachment
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={onRequestDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete attachment
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="text-xs truncate text-foreground/90" title={attachment.file_name}>
        {attachment.file_name}
      </p>
    </div>
  );
}

function AddTile({
  onClick,
  disabled,
  pending,
}: {
  onClick: () => void;
  disabled: boolean;
  pending: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ width: TILE_W, height: TILE_H }}
      className="rounded-md border-2 border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors flex items-center justify-center"
      aria-label="Add attachments"
    >
      {pending ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <Plus className="h-5 w-5" />
      )}
    </button>
  );
}

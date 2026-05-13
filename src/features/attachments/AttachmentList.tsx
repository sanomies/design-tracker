import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  Download,
  Loader2,
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
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/database";

import { AttachmentLightbox } from "./AttachmentLightbox";
import {
  FileTypeIcon,
  downloadAttachment,
  extensionLabel,
  isImageAttachment,
} from "./shared";
import {
  getSignedAttachmentUrl,
  MAX_ATTACHMENT_BYTES,
  useAttachments,
  useDeleteAttachment,
  useUploadAttachment,
} from "./useAttachments";

const TILE_W = 140;
const TILE_H = 100;

export function AttachmentList({ taskId }: { taskId: string }) {
  const { data: attachments, isLoading } = useAttachments(taskId);
  const upload = useUploadAttachment(taskId);
  const remove = useDeleteAttachment(taskId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDelete, setPendingDelete] = useState<Attachment | null>(null);
  const [lightboxId, setLightboxId] = useState<string | null>(null);

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
        <div className="flex flex-wrap gap-2">
          {attachments?.map((a) => (
            <AttachmentTile
              key={a.id}
              attachment={a}
              onOpen={() => setLightboxId(a.id)}
              onRequestDelete={() => setPendingDelete(a)}
            />
          ))}
          <AddTile onClick={onPickFiles} disabled={upload.isPending} pending={upload.isPending} />
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
              className="w-full h-full object-cover"
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

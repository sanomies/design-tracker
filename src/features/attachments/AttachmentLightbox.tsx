import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { format, parseISO } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/database";

import {
  FileTypeIcon,
  downloadAttachment,
  extensionLabel,
  formatBytes,
  isImageAttachment,
  openAttachmentInTab,
} from "./shared";
import { getSignedAttachmentUrl } from "./useAttachments";

type Props = {
  attachments: Attachment[];
  currentId: string;
  onCurrentIdChange: (id: string) => void;
  onClose: () => void;
};

export function AttachmentLightbox({
  attachments,
  currentId,
  onCurrentIdChange,
  onClose,
}: Props) {
  const index = attachments.findIndex((a) => a.id === currentId);
  const current = index >= 0 ? attachments[index] : undefined;
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < attachments.length - 1;

  // Close the lightbox if the current attachment disappears (e.g., deleted
  // from another tab while it was open).
  useEffect(() => {
    if (attachments.length === 0 || index < 0) onClose();
  }, [attachments.length, index, onClose]);

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowLeft" && hasPrev) {
        e.preventDefault();
        const prev = attachments[index - 1];
        if (prev) onCurrentIdChange(prev.id);
      } else if (e.key === "ArrowRight" && hasNext) {
        e.preventDefault();
        const next = attachments[index + 1];
        if (next) onCurrentIdChange(next.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [attachments, index, hasPrev, hasNext, onCurrentIdChange, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!current) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${current.file_name}`}
      className="fixed inset-0 z-[60] bg-zinc-950/95 text-white flex flex-col"
    >
      <TopBar attachment={current} onClose={onClose} />

      <div
        className="flex-1 min-h-0 relative"
        // Clicking the dark area around the preview closes the lightbox.
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <Preview attachment={current} />
        </div>

        {/* Arrows render AFTER the preview overlay so they stack above it.
            Without this the inset-0 overlay swallows arrow clicks. */}
        {hasPrev && (
          <NavArrow
            dir="left"
            onClick={() => onCurrentIdChange(attachments[index - 1]!.id)}
          />
        )}
        {hasNext && (
          <NavArrow
            dir="right"
            onClick={() => onCurrentIdChange(attachments[index + 1]!.id)}
          />
        )}
      </div>

      <ThumbStrip
        attachments={attachments}
        currentId={current.id}
        onSelect={onCurrentIdChange}
      />
    </div>,
    document.body
  );
}

// Top bar ---------------------------------------------------------------

function TopBar({
  attachment,
  onClose,
}: {
  attachment: Attachment;
  onClose: () => void;
}) {
  const createdAt = parseISO(attachment.created_at);
  return (
    <header className="shrink-0 flex items-center justify-between gap-4 px-4 h-14 border-b border-white/10">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{attachment.file_name}</p>
        <p className="text-xs text-white/60">
          {format(createdAt, "d MMM, yyyy 'at' h:mm a")}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/10 hover:text-white"
          onClick={() => void downloadAttachment(attachment)}
        >
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10 hover:text-white"
          onClick={onClose}
          aria-label="Close preview"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}

// Preview area ----------------------------------------------------------

function Preview({ attachment }: { attachment: Attachment }) {
  const isImage = isImageAttachment(attachment);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setFailed(false);
    getSignedAttachmentUrl(attachment.storage_path)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attachment.storage_path]);

  if (isImage && url && !failed) {
    return (
      <img
        src={url}
        alt={attachment.file_name}
        className="max-h-full max-w-full object-contain select-none"
        onError={() => setFailed(true)}
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />
    );
  }

  if (isImage && !url && !failed) {
    return <Loader2 className="h-8 w-8 animate-spin text-white/70" />;
  }

  // Non-image or failed-to-load image: fallback card.
  return (
    <div
      className="rounded-lg bg-zinc-900/70 border border-white/10 p-8 max-w-md w-full text-center space-y-4"
      onClick={(e) => e.stopPropagation()}
    >
      <FileTypeIcon mime={attachment.mime_type} size="lg" className="text-white/80 mx-auto" />
      <div className="space-y-1">
        <p className="text-base font-medium break-words">{attachment.file_name}</p>
        <p className="text-sm text-white/60">
          {extensionLabel(attachment.file_name, attachment.mime_type)} ·{" "}
          {formatBytes(attachment.file_size)}
        </p>
      </div>
      <div className="flex gap-2 justify-center">
        <Button
          variant="secondary"
          onClick={() => void downloadAttachment(attachment)}
        >
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
        <Button
          variant="ghost"
          className="text-white hover:bg-white/10 hover:text-white"
          onClick={() => void openAttachmentInTab(attachment)}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Open in new tab
        </Button>
      </div>
    </div>
  );
}

// Navigation arrows -----------------------------------------------------

function NavArrow({
  dir,
  onClick,
}: {
  dir: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "left" ? "Previous" : "Next"}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full",
        "bg-white/10 hover:bg-white/20 text-white flex items-center justify-center",
        "transition-colors",
        dir === "left" ? "left-4" : "right-4"
      )}
    >
      {dir === "left" ? (
        <ChevronLeft className="h-5 w-5" />
      ) : (
        <ChevronRight className="h-5 w-5" />
      )}
    </button>
  );
}

// Thumbnail strip -------------------------------------------------------

function ThumbStrip({
  attachments,
  currentId,
  onSelect,
}: {
  attachments: Attachment[];
  currentId: string;
  onSelect: (id: string) => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);

  // Keep the active thumbnail visible.
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-id="${currentId}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [currentId]);

  if (attachments.length <= 1) return null;

  return (
    <div className="shrink-0 border-t border-white/10 bg-zinc-900/60 px-4 py-3">
      <div ref={stripRef} className="flex gap-2 overflow-x-auto">
        {attachments.map((a) => (
          <StripThumb
            key={a.id}
            attachment={a}
            active={a.id === currentId}
            onClick={() => onSelect(a.id)}
          />
        ))}
      </div>
    </div>
  );
}

function StripThumb({
  attachment,
  active,
  onClick,
}: {
  attachment: Attachment;
  active: boolean;
  onClick: () => void;
}) {
  const isImage = isImageAttachment(attachment);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isImage) return;
    let cancelled = false;
    getSignedAttachmentUrl(attachment.storage_path)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attachment.storage_path, isImage]);

  const showImage = isImage && url && !failed;

  return (
    <button
      type="button"
      data-id={attachment.id}
      onClick={onClick}
      aria-label={attachment.file_name}
      aria-pressed={active}
      title={attachment.file_name}
      className={cn(
        "shrink-0 h-14 w-14 rounded-md overflow-hidden bg-zinc-800 border transition",
        active ? "border-white ring-1 ring-white" : "border-white/10 hover:border-white/40"
      )}
    >
      {showImage ? (
        <img
          src={url}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
          draggable={false}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <FileTypeIcon
            mime={attachment.mime_type}
            size="sm"
            className="text-white/70"
          />
        </div>
      )}
    </button>
  );
}

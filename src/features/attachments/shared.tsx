import { toast } from "sonner";
import {
  File as FileIconLucide,
  FileAudio,
  FileText,
  FileVideo,
  Image as ImageIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/database";

import { getSignedAttachmentUrl } from "./useAttachments";

export function isImageAttachment(a: Attachment): boolean {
  return a.mime_type?.startsWith("image/") ?? false;
}

export function FileTypeIcon({
  mime,
  size = "md",
  className,
}: {
  mime: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeCls =
    size === "lg" ? "h-8 w-8" : size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const cls = cn("shrink-0", sizeCls, className);
  if (!mime) return <FileIconLucide className={cls} />;
  if (mime.startsWith("image/")) return <ImageIcon className={cls} />;
  if (mime.startsWith("video/")) return <FileVideo className={cls} />;
  if (mime.startsWith("audio/")) return <FileAudio className={cls} />;
  if (mime === "application/pdf" || mime.startsWith("text/")) {
    return <FileText className={cls} />;
  }
  return <FileIconLucide className={cls} />;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function extensionLabel(fileName: string, mime: string | null): string {
  const fromName = fileName.split(".").pop()?.toUpperCase();
  if (fromName && fromName.length <= 5 && fromName !== fileName.toUpperCase()) {
    return fromName;
  }
  if (mime) {
    const sub = mime.split("/")[1];
    if (sub) return sub.toUpperCase();
  }
  return "FILE";
}

export async function downloadAttachment(attachment: Attachment): Promise<void> {
  try {
    const url = await getSignedAttachmentUrl(attachment.storage_path, {
      download: attachment.file_name,
    });
    const a = document.createElement("a");
    a.href = url;
    a.download = attachment.file_name;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    toast.error("Failed to download attachment");
  }
}

export async function openAttachmentInTab(attachment: Attachment): Promise<void> {
  try {
    const url = await getSignedAttachmentUrl(attachment.storage_path);
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    toast.error("Failed to open attachment");
  }
}

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

/**
 * Packages every passed attachment into a single .zip in-browser via JSZip
 * and triggers a download. Individual fetch errors are swallowed (the zip
 * still ships with the files we did get), and an empty input is a no-op.
 *
 * `zipName` should end in ".zip". Sanitize it before passing.
 */
export async function downloadAttachmentsAsZip(
  attachments: Attachment[],
  zipName: string
): Promise<void> {
  if (attachments.length === 0) return;
  // Lazy-import JSZip so it's only pulled in when the user actually uses
  // bulk download — avoids the ~95 KB cost on every task panel.
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  // Dedupe file names — if two attachments share a name, suffix with (1),
  // (2), etc., so the zip doesn't silently overwrite entries.
  const seen = new Map<string, number>();
  const uniqueName = (name: string): string => {
    const used = seen.get(name) ?? 0;
    seen.set(name, used + 1);
    if (used === 0) return name;
    const dot = name.lastIndexOf(".");
    if (dot <= 0) return `${name} (${used})`;
    return `${name.slice(0, dot)} (${used})${name.slice(dot)}`;
  };

  let failures = 0;
  await Promise.all(
    attachments.map(async (a) => {
      try {
        const url = await getSignedAttachmentUrl(a.storage_path);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const blob = await res.blob();
        zip.file(uniqueName(a.file_name), blob);
      } catch {
        failures += 1;
      }
    })
  );

  if (failures > 0) {
    toast.warning(`${failures} file${failures === 1 ? "" : "s"} couldn't be added to the zip`);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const objectUrl = URL.createObjectURL(zipBlob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = zipName;
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke a tick later so the click has time to register on slower
  // browsers; immediate revoke can cancel the download.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function openAttachmentInTab(attachment: Attachment): Promise<void> {
  try {
    const url = await getSignedAttachmentUrl(attachment.storage_path);
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    toast.error("Failed to open attachment");
  }
}

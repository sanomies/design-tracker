import {
  Download,
  File as FileIconLucide,
  FileAudio,
  FileText,
  FileVideo,
  Image as ImageIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { downloadFileFromUrl } from "./inlineImageUtils";

type Props = {
  src: string;
  name: string;
  className?: string;
};

/**
 * Renders a non-image inline file (PDF, doc, etc.) embedded in a comment or
 * description as a clickable tile — file-type icon on the left, filename +
 * extension on the right — matching the look of attachment tiles.
 *
 * The parser swaps `<a href="...task-images/...">name</a>` for this when
 * rendering comment HTML, so files inserted via drop/paste look like first-
 * class objects rather than plain hyperlinks.
 */
export function InlineFileCard({ src, name, className }: Props) {
  const mime = inferMimeFromName(name);
  const ext = extLabel(name, mime);

  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "not-prose inline-flex items-center gap-2 max-w-full w-[280px] rounded-md border bg-muted/40 px-3 py-2 hover:bg-muted/60 transition-colors no-underline align-middle",
        className
      )}
    >
      <FileGlyph mime={mime} />
      <div className="flex-1 min-w-0 leading-tight">
        <p className="text-sm font-medium truncate text-foreground" title={name}>
          {name}
        </p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {ext}
        </p>
      </div>
      <button
        type="button"
        // Stop the outer `<a>`'s open-in-new-tab so this acts as a download
        // button instead of a second click target for the same navigation.
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void downloadFileFromUrl(src, name);
        }}
        className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
        aria-label={`Download ${name}`}
        title={`Download ${name}`}
      >
        <Download className="h-3.5 w-3.5" />
      </button>
    </a>
  );
}

function FileGlyph({ mime }: { mime: string | null }) {
  const cls = "h-7 w-7 shrink-0 text-muted-foreground";
  if (!mime) return <FileIconLucide className={cls} />;
  if (mime.startsWith("image/")) return <ImageIcon className={cls} />;
  if (mime.startsWith("video/")) return <FileVideo className={cls} />;
  if (mime.startsWith("audio/")) return <FileAudio className={cls} />;
  if (mime === "application/pdf" || mime.startsWith("text/")) {
    return <FileText className={cls} />;
  }
  return <FileIconLucide className={cls} />;
}

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  md: "text/markdown",
  json: "application/json",
  zip: "application/zip",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  mov: "video/quicktime",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

function inferMimeFromName(name: string): string | null {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = name.slice(dot + 1).toLowerCase();
  return EXT_TO_MIME[ext] ?? null;
}

function extLabel(name: string, mime: string | null): string {
  const fromName = name.split(".").pop()?.toUpperCase();
  if (fromName && fromName.length <= 5 && fromName !== name.toUpperCase()) {
    return fromName;
  }
  if (mime) {
    const sub = mime.split("/")[1];
    if (sub) return sub.toUpperCase();
  }
  return "FILE";
}

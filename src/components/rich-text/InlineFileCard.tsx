import {
  File as FileIconLucide,
  FileArchive,
  FileAudio,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Image as ImageIcon,
  Presentation,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { downloadFileFromUrl } from "./inlineImageUtils";

type Props = {
  src: string;
  name: string;
  className?: string;
};

/**
 * Renders a non-image inline file (PDF, doc, zip, video, audio…) embedded
 * in a comment or description as a pill — file-type tile on the left,
 * filename + "TYPE File | Download" on the right. The card itself opens
 * the file in a new tab; the "Download" affordance is a separate click
 * target that bypasses the open-in-tab behaviour.
 *
 * Visual spec lifted from Figma node 417:10336 et al. — 16px radius pill,
 * 36×36 light-gray icon tile inside, 14px filename, 12px meta row.
 */
export function InlineFileCard({ src, name, className }: Props) {
  const ext = extension(name);
  const kind = fileKind(ext);
  const kindLabel = friendlyKindLabel(ext, kind);

  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "not-prose inline-flex items-center gap-2 max-w-full",
        "rounded-2xl border border-[#DEDFE0] bg-white hover:bg-[#F6F9F9] transition-colors",
        "pl-2 pr-4 py-2 no-underline align-middle",
        className
      )}
    >
      <span
        className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-lg border border-[#DEDFE0] bg-[#F6F9F9]"
        aria-hidden
      >
        <FileGlyph kind={kind} />
      </span>
      <span className="flex flex-col items-start gap-1 leading-tight min-w-0">
        <span
          className="text-sm font-medium text-foreground truncate max-w-[220px]"
          title={name}
        >
          {name}
        </span>
        <span className="flex items-center gap-1 text-xs text-[#708597]">
          <span>{kindLabel}</span>
          <span aria-hidden>|</span>
          <button
            type="button"
            // Stop the outer `<a>`'s open-in-new-tab so this acts as a
            // download button instead of a second click target for the
            // same navigation.
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void downloadFileFromUrl(src, name);
            }}
            className="font-semibold text-foreground hover:underline"
          >
            Download
          </button>
        </span>
      </span>
    </a>
  );
}

// File-kind taxonomy ----------------------------------------------------
//
// Splitting into kinds (rather than mime-strings) lets one icon paint
// for the whole "office docs" family while keeping zip/audio/video
// distinct. New extensions can be added below without touching the
// renderer.

type Kind =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "word"
  | "excel"
  | "powerpoint"
  | "archive"
  | "text"
  | "other";

function fileKind(ext: string): Kind {
  switch (ext) {
    case "png": case "jpg": case "jpeg": case "gif": case "webp": case "svg":
      return "image";
    case "mp4": case "mov": case "avi": case "mkv": case "webm":
      return "video";
    case "mp3": case "wav": case "ogg": case "flac": case "m4a":
      return "audio";
    case "pdf":
      return "pdf";
    case "doc": case "docx":
      return "word";
    case "xls": case "xlsx": case "csv":
      return "excel";
    case "ppt": case "pptx":
      return "powerpoint";
    case "zip": case "rar": case "7z": case "tar": case "gz":
      return "archive";
    case "txt": case "md": case "json":
      return "text";
    default:
      return "other";
  }
}

function FileGlyph({ kind }: { kind: Kind }) {
  const cls = "h-[18px] w-[18px] text-foreground";
  switch (kind) {
    case "image":      return <ImageIcon className={cls} />;
    case "video":      return <FileVideo className={cls} />;
    case "audio":      return <FileAudio className={cls} />;
    case "pdf":        return <FileText className={cls} />;
    case "word":       return <FileText className={cls} />;
    case "excel":      return <FileSpreadsheet className={cls} />;
    case "powerpoint": return <Presentation className={cls} />;
    case "archive":    return <FileArchive className={cls} />;
    case "text":       return <FileText className={cls} />;
    case "other":      return <FileIconLucide className={cls} />;
  }
}

// Human-readable label shown next to the filename ("ZIP File", "Word
// File", "MP4 File", etc.). Falls back to the uppercase extension for
// anything outside the curated table.
function friendlyKindLabel(ext: string, kind: Kind): string {
  if (kind === "word")       return "Word File";
  if (kind === "excel")      return ext === "csv" ? "CSV File" : "Excel File";
  if (kind === "powerpoint") return "Powerpoint File";
  if (kind === "pdf")        return "PDF File";
  if (kind === "archive")    return `${ext.toUpperCase()} File`;
  if (kind === "video")      return `${ext.toUpperCase()} File`;
  if (kind === "audio")      return `${ext.toUpperCase()} File`;
  if (kind === "image")      return `${ext.toUpperCase()} File`;
  if (kind === "text")       return `${ext.toUpperCase()} File`;
  // Unknown extension — uppercase the suffix or fall back to a generic
  // "File" label so the meta row never reads "undefined File".
  return ext ? `${ext.toUpperCase()} File` : "File";
}

function extension(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "";
  return name.slice(dot + 1).toLowerCase();
}

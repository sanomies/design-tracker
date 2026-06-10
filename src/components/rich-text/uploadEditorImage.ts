import { supabase } from "@/lib/supabase";

const EDITOR_IMAGES_BUCKET = "task-images";

// 10 MB cap on inline editor images. Attachments allow 50 MB, but for inline
// description content that's overkill — pasted screenshots are typically <2MB.
export const MAX_EDITOR_IMAGE_BYTES = 10 * 1024 * 1024;
// Higher cap for non-image inline files (PDFs etc.) since those compress less.
export const MAX_EDITOR_FILE_BYTES = 50 * 1024 * 1024;

/**
 * Uploads an image file to the public `task-images` bucket and returns the
 * public URL. Path convention is `{task_id}/{uuid}.{ext}` so the bucket's
 * project-membership RLS check (see migration 0013) gates writes.
 */
export async function uploadEditorImage(file: File, taskId: string): Promise<string> {
  if (!taskId) throw new Error("No task");
  if (file.size > MAX_EDITOR_IMAGE_BYTES) {
    throw new Error("Image is over the 10 MB limit");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Not an image");
  }
  // SVGs can carry inline <script> and would execute if opened from the public
  // bucket origin. The bucket's allowed_mime_types (migration 0027) also rejects
  // them; this is the friendly client-side guard. Raster images only.
  if (file.type === "image/svg+xml") {
    throw new Error("SVG images aren't supported");
  }

  const ext = extensionForMime(file.type) ?? extensionFromName(file.name) ?? "png";
  const path = `${taskId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(EDITOR_IMAGES_BUCKET)
    .upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(EDITOR_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Uploads any file (non-image) to the same public `task-images` bucket and
 * returns the public URL. Used when a PDF/doc/etc. is dropped or pasted into
 * the rich-text editor — we embed it as a clickable link inline in the
 * comment/description rather than routing it to task attachments.
 */
// Types a browser will execute as script when the object is opened top-level
// from the storage origin. Stored as application/octet-stream instead so they
// download rather than render inline (the bucket allowlist in 0027 also blocks
// these, but normalizing here keeps any oddball MIME the browser reports from
// being rejected outright — unknown/empty types fall through to octet-stream).
const INLINE_EXECUTABLE_MIME = new Set([
  "text/html",
  "image/svg+xml",
  "application/xhtml+xml",
  "text/xml",
  "application/xml",
]);

// Content-types we’re happy to serve inline (preview-in-tab). Everything else
// is uploaded as application/octet-stream so it downloads instead of rendering.
const INLINE_SAFE_MIME = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp", "image/avif",
  "application/pdf", "text/plain", "text/csv", "text/markdown", "application/json",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip", "application/x-rar-compressed", "application/x-7z-compressed",
  "application/x-tar", "application/gzip",
  "video/mp4", "video/quicktime", "video/webm",
  "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4",
]);

export async function uploadEditorFile(file: File, taskId: string): Promise<string> {
  if (!taskId) throw new Error("No task");
  if (file.size > MAX_EDITOR_FILE_BYTES) {
    throw new Error(`${file.name} is over the 50 MB limit`);
  }

  // Never store an attacker-controlled content-type that would render inline.
  // Known-safe types keep their type (so they can preview in a tab); dangerous,
  // unknown, or empty types are stored as octet-stream → download, never script.
  const contentType =
    !INLINE_EXECUTABLE_MIME.has(file.type) && INLINE_SAFE_MIME.has(file.type)
      ? file.type
      : "application/octet-stream";

  const ext = extensionForMime(file.type) ?? extensionFromName(file.name) ?? "bin";
  const path = `${taskId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(EDITOR_IMAGES_BUCKET)
    .upload(path, file, {
      contentType,
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(EDITOR_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function extensionForMime(mime: string): string | null {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/avif": "avif",
  };
  return map[mime] ?? null;
}

function extensionFromName(name: string): string | null {
  const dot = name.lastIndexOf(".");
  if (dot < 0 || dot === name.length - 1) return null;
  return name.slice(dot + 1).toLowerCase();
}

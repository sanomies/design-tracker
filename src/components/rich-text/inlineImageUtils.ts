import { toast } from "sonner";

import { supabase } from "@/lib/supabase";

const PUBLIC_URL_RE = /\/storage\/v1\/object\/public\/task-images\/(.+?)(?:\?|$)/;

/**
 * If the image URL points at our public `task-images` bucket, returns the
 * storage path (`{task_id}/{uuid}.{ext}`). Returns null for external URLs
 * (pasted-from-elsewhere images) — those can be removed from the comment
 * body but we obviously can't delete the underlying object.
 */
export function extractTaskImagePath(url: string): string | null {
  try {
    // Resolve relative URLs against the current origin so the regex sees the
    // full path. URL constructor throws on bad input → fall back to null.
    const u = new URL(url, window.location.origin);
    const m = u.pathname.match(PUBLIC_URL_RE);
    return m && m[1] ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

/**
 * Returns every `<img>` src in the given HTML, in document order. Used to
 * decide whether to show the comment-level "Download all" 3-dot menu and to
 * gather URLs for it.
 */
export function extractImageUrls(html: string | null | undefined): string[] {
  if (!html) return [];
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  return Array.from(doc.body.querySelectorAll("img"))
    .map((img) => img.getAttribute("src") ?? "")
    .filter(Boolean);
}

/**
 * Returns every `<a href>` URL in the HTML whose href points at our
 * task-images bucket — i.e., the non-image inline files (PDFs, docs)
 * inserted via drop/paste. External links are excluded.
 */
export function extractFileUrls(html: string | null | undefined): string[] {
  if (!html) return [];
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  return Array.from(doc.body.querySelectorAll("a[href]"))
    .map((a) => a.getAttribute("href") ?? "")
    .filter((href) => !!href && extractTaskImagePath(href) !== null);
}

/**
 * Removes the first `<img>` whose src matches from the html and returns the
 * resulting string. Match is exact on the raw attribute value (so we don't
 * over-match by accidentally normalizing relative vs. absolute URLs).
 */
export function removeImageFromHtml(html: string, src: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const wrapper = doc.body.firstElementChild as HTMLElement | null;
  if (!wrapper) return html;
  const imgs = Array.from(wrapper.querySelectorAll("img"));
  for (const img of imgs) {
    if (img.getAttribute("src") === src) {
      img.remove();
      break;
    }
  }
  return wrapper.innerHTML;
}

export async function deleteTaskImageObject(url: string): Promise<void> {
  const path = extractTaskImagePath(url);
  if (!path) return;
  // Best-effort — RLS blocks anyone outside the project, but project members
  // can clean up. Silent failure is fine: the comment update already
  // removed the reference, so an orphan is the worst case.
  await supabase.storage.from("task-images").remove([path]);
}

/**
 * Fetches the image and triggers a "Save as" download. Falls back to opening
 * the URL in a new tab if CORS blocks the fetch.
 */
export async function downloadImage(url: string): Promise<void> {
  const filename = filenameFromUrl(url);
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const blob = await res.blob();
    triggerBlobDownload(blob, filename);
  } catch {
    toast.error("Failed to download image");
  }
}

/**
 * Like `downloadImage` but accepts an explicit filename. Used by file cards
 * where we kept the original filename (from the link's text content) and
 * don't want to fall back to the storage UUID.
 */
export async function downloadFileFromUrl(
  url: string,
  filename: string
): Promise<void> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const blob = await res.blob();
    triggerBlobDownload(blob, filename);
  } catch {
    toast.error("Failed to download file");
  }
}

export async function downloadImagesAsZip(
  urls: string[],
  zipName: string
): Promise<void> {
  if (urls.length === 0) return;
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

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
    urls.map(async (url) => {
      try {
        const res = await fetch(url, { mode: "cors" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const blob = await res.blob();
        zip.file(uniqueName(filenameFromUrl(url)), blob);
      } catch {
        failures += 1;
      }
    })
  );

  if (failures > 0) {
    toast.warning(`${failures} image${failures === 1 ? "" : "s"} couldn't be added to the zip`);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  triggerBlobDownload(zipBlob, zipName);
}

function filenameFromUrl(url: string): string {
  try {
    const u = new URL(url, window.location.origin);
    const last = u.pathname.split("/").filter(Boolean).pop() ?? "";
    return decodeURIComponent(last) || "image";
  } catch {
    return "image";
  }
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

import type { ReactNode } from "react";

const FIGMA_URL_RE = /^https?:\/\/(?:www\.)?figma\.com\//i;

/** True for any figma.com URL — files (`/file`, `/design`, `/proto`),
 *  FigJam boards (`/board`), Slides, Make files, community pages, etc.
 *  Used by RichTextContent to swap plain anchors for inline previews. */
export function isFigmaUrl(url: string): boolean {
  return FIGMA_URL_RE.test(url);
}

/** Constructs Figma's official embed URL from a regular share URL. Figma
 *  accepts the full source URL as a query parameter and returns an
 *  iframe-friendly view of the file (sign-in prompt for private files,
 *  full preview for public / shared ones). */
export function getFigmaEmbedUrl(url: string): string {
  return `https://www.figma.com/embed?embed_host=osano&url=${encodeURIComponent(url)}`;
}

type Props = {
  src: string;
  children: ReactNode;
};

/**
 * Inline Figma preview card — renders the original link followed by a
 * 16:9 embed iframe of the file. Used in the read-only RichTextContent
 * path so pasted Figma URLs in comments/descriptions unfurl to a
 * thumbnail (matches the Asana/Linear/Notion pattern).
 *
 * The wrapping element is a `<span>` with `display: block` because the
 * parent is usually a `<p>` (TipTap wraps text in paragraphs) — putting
 * a `<div>` inside a `<p>` would be invalid HTML. The `not-prose` class
 * opts the card out of any inherited typography styles.
 */
export function FigmaEmbed({ src, children }: Props) {
  return (
    <span className="not-prose block my-2">
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 break-all"
      >
        {children}
      </a>
      <span className="block mt-1 rounded-md border border-[#DEDFE0] bg-[#F6F9F9] overflow-hidden">
        <iframe
          src={getFigmaEmbedUrl(src)}
          // 16:9 keeps the card from dominating the comment list while
          // still being big enough to read the file content. The user
          // can click into the link itself to open the full Figma view.
          className="block w-full aspect-[16/9] border-0"
          allow="fullscreen; clipboard-read; clipboard-write"
          title="Figma preview"
          loading="lazy"
        />
      </span>
    </span>
  );
}

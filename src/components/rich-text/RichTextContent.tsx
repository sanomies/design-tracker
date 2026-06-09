import { useMemo, type ReactNode } from "react";
import DOMPurify from "dompurify";

import { cn } from "@/lib/utils";

import { htmlToReact } from "./htmlToReact";
import { InlineFileCard } from "./InlineFileCard";
import { InlineImage } from "./InlineImage";
import { extractTaskImagePath } from "./inlineImageUtils";

const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "u", "s", "ul", "ol", "li",
  "code", "pre", "span", "a", "blockquote", "hr",
  "h1", "h2",
  "table", "thead", "tbody", "tr", "th", "td",
  "img",
];

const ALLOWED_ATTR = [
  "class", "data-type", "data-id", "data-label", "data-banner-id", "data-name",
  "href", "target", "rel",
  "src", "alt",
  "colspan", "rowspan",
];

type Props = {
  html: string | null | undefined;
  className?: string;
  /** When provided, every inline `<img>` renders with a delete button that
   *  calls this with the image's src. The caller is responsible for stripping
   *  the image from the underlying body and cleaning up storage. */
  onDeleteImage?: (src: string) => void;
};

export function RichTextContent({ html, className, onDeleteImage }: Props) {
  const safeHtml = useMemo(() => {
    if (!html) return "";
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ADD_ATTR: ["target"],
      ALLOW_DATA_ATTR: false,
    });
  }, [html]);

  const tree = useMemo(() => {
    if (!safeHtml) return null;
    try {
      return htmlToReact(
        safeHtml,
        (props, key) => (
          <InlineImage
            key={key}
            src={props.src}
            alt={props.alt}
            className={props.className}
            onDelete={onDeleteImage}
          />
        ),
        // Swap any link pointing at the task-images bucket for a file
        // card. These are the non-image files inserted via drop/paste in
        // the editor (PDFs etc.). External links render normally.
        (props, key, children) => {
          if (!props.href) return undefined;
          if (!extractTaskImagePath(props.href)) return undefined;
          const name = reactNodeToText(children) || "Untitled";
          // Bypass image detection — the link could resolve to a .pdf/.docx
          // inside the task-images bucket; we treat ANY non-image-link there
          // as a file card.
          if (looksLikeImageName(name)) return undefined;
          return <InlineFileCard key={key} src={props.href} name={name} />;
        }
      );
    } catch {
      // Defensive: if the parser ever chokes on an unexpected HTML shape we
      // don't want to take down the whole comment list. Fall back to the
      // sanitized HTML directly — no inline-image controls in that case,
      // but the comment is still readable.
      return (
        <div
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      );
    }
  }, [safeHtml, onDeleteImage]);

  if (!tree) return null;

  return <div className={cn("tiptap-content", className)}>{tree}</div>;
}

/** Flattens a ReactNode tree into a plain text string. We use this to recover
 *  the original filename from the `<a>` element's text content so the file
 *  card can display it. */
function reactNodeToText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(reactNodeToText).join("");
  return "";
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico|heic|heif)$/i;
function looksLikeImageName(name: string): boolean {
  return IMAGE_EXT.test(name.trim());
}

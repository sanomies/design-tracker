import { useMemo } from "react";
import DOMPurify from "dompurify";

import { cn } from "@/lib/utils";

const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "u", "s", "ul", "ol", "li",
  "code", "pre", "span", "a", "blockquote", "hr",
  "h1", "h2",
  "table", "thead", "tbody", "tr", "th", "td",
  "img",
];

const ALLOWED_ATTR = [
  "class", "data-type", "data-id", "data-label",
  "href", "target", "rel",
  "src", "alt",
  "colspan", "rowspan",
];

export function RichTextContent({
  html,
  className,
}: {
  html: string | null | undefined;
  className?: string;
}) {
  const safeHtml = useMemo(() => {
    if (!html) return "";
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      // Add nofollow + noopener to any rendered link, just in case the
      // stored HTML missed them.
      ADD_ATTR: ["target"],
      ALLOW_DATA_ATTR: false,
    });
  }, [html]);

  if (!safeHtml) return null;

  return (
    <div
      className={cn("tiptap-content", className)}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}

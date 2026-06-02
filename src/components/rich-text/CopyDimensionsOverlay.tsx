import { useCallback, useEffect, useState } from "react";
import { Copy } from "lucide-react";
import type { Editor } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { toast } from "sonner";

import { formatBannerLabel, getBanner } from "./bannerCatalog";

/** Single "Copy" button anchored to the top-right of the editor, visible
 *  whenever the description contains ≥1 banner pill. Clicking copies every
 *  banner across the description as `Name — Dimensions`, one per line, in
 *  document order.
 *
 *  The button is rendered inside the editor wrapper (not a portal), so it
 *  doesn't fight the editor's hover state with mouseenter / mouseleave
 *  races — earlier the portal'd button visually overlapped the pills, which
 *  caused the button to flicker as the cursor crossed in and out of it. */
export function CopyDimensionsOverlay({ editor }: { editor: Editor }) {
  const [bannerCount, setBannerCount] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const recount = () => setBannerCount(countBanners(editor));
    recount();
    editor.on("update", recount);
    return () => {
      editor.off("update", recount);
    };
  }, [editor]);

  const handleCopy = useCallback(async () => {
    if (!editor) return;
    const lines: string[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === "banner") {
        const b = getBanner(node.attrs.bannerId);
        if (b) lines.push(formatBannerLabel(b));
      }
      return true;
    });
    if (lines.length === 0) return;
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success(`Copied ${lines.length} banner${lines.length === 1 ? "" : "s"}`);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }, [editor]);

  if (bannerCount === 0) return null;

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={handleCopy}
      title={`Copy ${bannerCount} banner${bannerCount === 1 ? "" : "s"}`}
      className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-sm hover:bg-accent"
    >
      <Copy className="h-3 w-3" />
      Copy banners
    </button>
  );
}

function countBanners(editor: Editor): number {
  let n = 0;
  editor.state.doc.descendants((node: PMNode) => {
    if (node.type.name === "banner") n += 1;
    return true;
  });
  return n;
}

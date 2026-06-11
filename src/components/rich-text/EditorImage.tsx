import { useState } from "react";
import Image from "@tiptap/extension-image";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { Download, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ImageLightbox } from "./ImageLightbox";
import { downloadImage } from "./inlineImageUtils";

/**
 * Live-editor view for TipTap's Image node — same visual treatment as
 * `InlineImage` (used by the read-only RichTextContent renderer): the
 * `<img>` plus a hover-revealed download + delete overlay in the top-
 * right corner. Lets users save inline images directly from the
 * description editor or comment composer.
 *
 * Delete is gated on `editor.isEditable` so a non-author viewing the
 * comment in a future read-only mode wouldn't get a destructive
 * button. (Today the editor is always editable for the comment's
 * author; this is forward-compatible.)
 */
function EditorImageView({ node, deleteNode, editor }: NodeViewProps) {
  const src = String(node.attrs.src ?? "");
  const alt = String(node.attrs.alt ?? "");
  const editable = editor.isEditable;
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (!src) return null;

  return (
    <NodeViewWrapper className="tiptap-inline-image relative inline-block group max-w-full align-middle leading-none my-2">
      <img
        src={src}
        alt={alt}
        // `tiptap-image` opts into the shared rounded + border styling
        // defined in rich-text.css, matching how the read-only renderer
        // displays the same image.
        className="tiptap-image max-w-full h-auto block !my-0 cursor-zoom-in"
        draggable={false}
        // Open the lightbox instead of letting the editor select the node;
        // delete is still available via the hover overlay button.
        onClick={(e) => {
          e.stopPropagation();
          setLightboxOpen(true);
        }}
      />
      {lightboxOpen && (
        <ImageLightbox src={src} alt={alt} onClose={() => setLightboxOpen(false)} />
      )}
      <span
        // `contentEditable=false` on the overlay so the editor's pointer
        // selection logic doesn't try to place the cursor inside the
        // buttons when the user clicks them.
        contentEditable={false}
        className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
      >
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="h-6 w-6 shadow-sm"
          aria-label="Download image"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void downloadImage(src);
          }}
        >
          <Download className="h-3 w-3" />
        </Button>
        {editable && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-6 w-6 shadow-sm text-destructive hover:text-destructive"
            aria-label="Delete image"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              deleteNode();
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </span>
    </NodeViewWrapper>
  );
}

/** TipTap Image extension extended with a React NodeView that wraps the
 *  rendered `<img>` in a hover-revealed download / delete overlay. The
 *  serialized HTML stays a plain `<img>` so the read-only renderer
 *  (RichTextContent) continues to handle it the same way it does today. */
export const EditorImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(EditorImageView);
  },
});

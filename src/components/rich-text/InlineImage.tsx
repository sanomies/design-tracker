import { useState } from "react";
import { Download, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ImageLightbox } from "./ImageLightbox";
import { downloadImage } from "./inlineImageUtils";

type Props = {
  src: string;
  alt?: string;
  className?: string;
  /** When provided, a delete button appears alongside the download button.
   *  Omitted for read-only viewers (non-author of a comment). */
  onDelete?: (src: string) => void;
};

/**
 * Renders an inline image with download (+ optional delete) buttons that
 * fade in on hover, mirroring the AttachmentTile affordance.
 *
 * The wrapper is `inline-block` so a single image inside a `<p>` still flows
 * with text, but `max-w-full` keeps wide images from overflowing the bubble.
 */
export function InlineImage({ src, alt, className, onDelete }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  return (
    <span className="tiptap-inline-image relative inline-block group max-w-full align-middle leading-none my-2">
      <img
        src={src}
        alt={alt ?? ""}
        className={cn(
          "tiptap-image max-w-full h-auto block !my-0 cursor-zoom-in",
          className
        )}
        draggable={false}
        onClick={() => setLightboxOpen(true)}
      />
      {lightboxOpen && (
        <ImageLightbox src={src} alt={alt} onClose={() => setLightboxOpen(false)} />
      )}
      <span className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="h-6 w-6 shadow-sm"
          aria-label="Download image"
          onClick={(e) => {
            e.preventDefault();
            void downloadImage(src);
          }}
        >
          <Download className="h-3 w-3" />
        </Button>
        {onDelete && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-6 w-6 shadow-sm text-destructive hover:text-destructive"
            aria-label="Delete image"
            onClick={(e) => {
              e.preventDefault();
              onDelete(src);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </span>
    </span>
  );
}

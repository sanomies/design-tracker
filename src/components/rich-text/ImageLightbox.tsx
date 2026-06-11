import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { downloadImage } from "./inlineImageUtils";

type Props = {
  src: string;
  alt?: string;
  onClose: () => void;
};

/**
 * Minimal full-screen viewer for a single inline image (description /
 * comment). Mirrors the AttachmentLightbox chrome (dark backdrop, contained
 * image, download + close) but without the attachment list / signed-URL /
 * metadata machinery — inline images are plain public URLs. Clicking the
 * backdrop or pressing Esc closes; clicking the image itself does not.
 */
export function ImageLightbox({ src, alt, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    // Lock body scroll while open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/95 p-4 text-white"
      onClick={onClose}
    >
      <div className="absolute right-3 top-3 flex gap-1">
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="h-9 w-9 shadow-sm"
          aria-label="Download image"
          onClick={(e) => {
            e.stopPropagation();
            void downloadImage(src);
          }}
        >
          <Download className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="h-9 w-9 shadow-sm"
          aria-label="Close"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <img
        src={src}
        alt={alt ?? ""}
        className="max-h-full max-w-full select-none rounded-lg object-contain shadow-2xl"
        // Don't let a click on the image bubble to the backdrop (which closes).
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  );
}

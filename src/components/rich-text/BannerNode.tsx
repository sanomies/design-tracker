import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { X } from "lucide-react";

import { formatBannerLabel, getBanner, type BannerCategory } from "./bannerCatalog";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    banner: {
      insertBanner: (bannerId: string) => ReturnType;
    };
  }
}

const CATEGORY_CLASS: Record<BannerCategory, string> = {
  desktop: "banner-pill-desktop",
  mobile: "banner-pill-mobile",
  social: "banner-pill-social",
};

/** Inline atom node that renders a banner reference as a styled pill.
 *  Storage is a single `data-banner-id` attribute — the displayed name +
 *  size is recomputed from the catalog every render, so renaming a banner
 *  in the catalog updates existing descriptions automatically. The plain
 *  renderHTML still bakes the current label into the span text so the
 *  read-only DOMPurify path (RichTextContent) shows the right text without
 *  needing the catalog at render time. */
export const BannerNode = Node.create({
  name: "banner",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      bannerId: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-banner-id"),
        renderHTML: (attrs) =>
          attrs.bannerId ? { "data-banner-id": attrs.bannerId } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="banner"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const banner = getBanner(node.attrs.bannerId);
    const label = banner ? formatBannerLabel(banner) : "Unknown banner";
    const categoryClass = banner ? CATEGORY_CLASS[banner.category] : "banner-pill-unknown";
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "banner",
        class: `banner-pill ${categoryClass}`,
      }),
      label,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BannerPillView);
  },

  addCommands() {
    return {
      insertBanner:
        (bannerId: string) =>
        ({ commands }) =>
          // Wrap each banner in its own paragraph so successive inserts
          // stack vertically as a list rather than running together on one
          // line. The node itself stays inline — prose can still be mixed
          // around an existing pill if the user wants.
          commands.insertContent({
            type: "paragraph",
            content: [{ type: this.name, attrs: { bannerId } }],
          }),
    };
  },
});

function BannerPillView({ node, deleteNode, editor }: NodeViewProps) {
  const banner = getBanner(node.attrs.bannerId);
  const label = banner ? formatBannerLabel(banner) : "Unknown banner";
  const categoryClass = banner ? CATEGORY_CLASS[banner.category] : "banner-pill-unknown";
  const editable = editor.isEditable;

  return (
    <NodeViewWrapper
      as="span"
      data-type="banner"
      data-banner-id={node.attrs.bannerId ?? ""}
      className={`banner-pill ${categoryClass}`}
      // contentEditable=false on the wrapper so cursor treats it as a single
      // atom — ProseMirror's atom flag is what enforces this at the model
      // level; we mirror it on the DOM so DOM-level selections behave too.
      contentEditable={false}
    >
      <span className="banner-pill-label">{label}</span>
      {editable && (
        <button
          type="button"
          aria-label={`Remove ${label}`}
          className="banner-pill-remove"
          // Prevent the click from blurring the editor before deleteNode
          // dispatches its transaction.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => deleteNode()}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </NodeViewWrapper>
  );
}

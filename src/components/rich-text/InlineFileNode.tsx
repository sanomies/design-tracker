import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { X } from "lucide-react";

import { InlineFileCard } from "./InlineFileCard";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    inlineFile: {
      insertInlineFile: (attrs: { href: string; name: string }) => ReturnType;
    };
  }
}

/**
 * Inline atom node that renders a file attachment as a chip — same visual
 * as `InlineFileCard` in the read-only comment / description view, but
 * via a TipTap NodeView so the editor itself shows the chip instead of a
 * plain underlined link.
 *
 * Storage shape (round-trips via parseHTML / renderHTML):
 *   <a class="inline-file-card" data-type="inline-file"
 *      data-name="<filename>" href="<url>"
 *      target="_blank" rel="noopener noreferrer">name</a>
 *
 * The read-only renderer (RichTextContent) already swaps any anchor that
 * points at the task-images bucket for an `InlineFileCard`, so existing
 * comments saved before this node existed keep working as before — only
 * NEW uploads route through this extension's NodeView in the editor.
 */
export const InlineFileNode = Node.create({
  name: "inlineFile",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("href"),
        renderHTML: (attrs) => (attrs.href ? { href: attrs.href } : {}),
      },
      name: {
        default: "File",
        // Prefer data-name so re-parsing doesn't depend on the visible
        // text node (which DOMPurify or other transforms might rewrite).
        parseHTML: (el) => {
          const el2 = el as HTMLElement;
          return el2.getAttribute("data-name") || el2.textContent || "File";
        },
        renderHTML: (attrs) =>
          attrs.name ? { "data-name": String(attrs.name) } : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'a.inline-file-card',
        // Win over the generic Link mark's `<a>` matcher.
        priority: 1000,
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = node.attrs.name || "File";
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        class: "inline-file-card",
        "data-type": "inline-file",
        target: "_blank",
        rel: "noopener noreferrer",
      }),
      label,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineFileNodeView);
  },

  addCommands() {
    return {
      insertInlineFile:
        ({ href, name }) =>
        ({ commands }) =>
          // Wrap each file in its own paragraph so successive inserts
          // stack on separate lines (matches the Figma — one chip per
          // row in the comment body).
          commands.insertContent({
            type: "paragraph",
            content: [{ type: this.name, attrs: { href, name } }],
          }),
    };
  },
});

function InlineFileNodeView({ node, deleteNode, editor }: NodeViewProps) {
  const href = String(node.attrs.href ?? "");
  const name = String(node.attrs.name ?? "File");
  const editable = editor.isEditable;

  return (
    <NodeViewWrapper
      as="span"
      data-type="inline-file"
      // contentEditable=false on the wrapper so the cursor treats the
      // chip as a single atom — ProseMirror's atom flag enforces this at
      // the model level; mirroring it on the DOM keeps DOM selections
      // sane too.
      contentEditable={false}
      className="inline-file-node-wrapper relative inline-block align-middle"
    >
      <InlineFileCard src={href} name={name} />
      {editable && (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          // Sits at the chip's top-right corner; the wrapper relative +
          // absolute positioning is intentional — the chip itself can't
          // host its own delete button without breaking the read-only
          // renderer (which uses the same InlineFileCard for the read
          // path).
          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-white border border-[#DEDFE0] shadow-sm inline-flex items-center justify-center text-[#708597] hover:text-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity inline-file-remove"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteNode();
          }}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </NodeViewWrapper>
  );
}

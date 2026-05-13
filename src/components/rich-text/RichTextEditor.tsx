import { useEffect, useRef, useState, type ReactNode } from "react";
import { EditorContent, ReactRenderer, useEditor, type Editor } from "@tiptap/react";
import type { Range } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Image from "@tiptap/extension-image";
import type { SuggestionOptions } from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import EmojiPicker, { EmojiStyle, Theme as EmojiTheme } from "emoji-picker-react";
import {
  Bold,
  Code,
  Code2,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Plus,
  Quote,
  Redo2,
  Smile,
  Strikethrough,
  Table as TableIcon,
  Underline as UnderlineIcon,
  Undo2,
  AtSign,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

import { MentionList, type MentionListHandle, type MentionItem } from "./MentionList";
import { SlashCommand, type SlashCommandPayload } from "./SlashCommandExtension";
import { SlashMenu, type SlashItem, type SlashMenuHandle } from "./SlashMenu";

type Props = {
  value: string;
  onChange?: (html: string) => void;
  onBlur?: (html: string) => void;
  members: Profile[];
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  minHeight?: string;
};

const EMPTY_HTML = ["", "<p></p>", "<p><br></p>"];

export function isEmptyHTML(html: string): boolean {
  return EMPTY_HTML.includes(html.trim());
}

function buildMentionSuggestion(
  // Ref, not array — the editor is mounted once but workspace members may
  // load AFTER mount. A closure over the array would freeze to whatever it
  // was at mount time (often `[]`). A ref always reads the latest value.
  membersRef: { current: Profile[] }
): Omit<SuggestionOptions<MentionItem>, "editor"> {
  return {
    items: ({ query }) => {
      const q = query.toLowerCase();
      return membersRef.current
        .filter((m) => (m.full_name ?? "").toLowerCase().includes(q))
        .slice(0, 6)
        .map((m) => ({ id: m.id, label: m.full_name ?? "Unnamed" }));
    },
    render: () => {
      let component: ReactRenderer<MentionListHandle> | null = null;
      let popup: TippyInstance | null = null;
      return {
        onStart: (props) => {
          component = new ReactRenderer(MentionList, { props, editor: props.editor });
          if (!props.clientRect) return;
          popup = tippy(document.body, {
            getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start",
            theme: "mention",
          });
        },
        onUpdate: (props) => {
          component?.updateProps(props);
          popup?.setProps({
            getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
          });
        },
        onKeyDown: (props) => {
          if (props.event.key === "Escape") {
            popup?.hide();
            return true;
          }
          return component?.ref?.onKeyDown(props.event) ?? false;
        },
        onExit: () => {
          popup?.destroy();
          component?.destroy();
          popup = null;
          component = null;
        },
      };
    },
  };
}

// Slash command items + suggestion config. Mirrors the toolbar's `+` menu —
// when the user picks one we first `deleteRange` so the typed `/query` is
// removed before the block transformation runs.
type SlashCommandItem = SlashCommandPayload &
  SlashItem & {
    keywords?: string[];
  };

function buildSlashSuggestion({
  onOpenImage,
  onOpenEmbed,
  onOpenEmoji,
}: {
  onOpenImage: () => void;
  onOpenEmbed: () => void;
  onOpenEmoji: () => void;
}): Omit<SuggestionOptions<SlashCommandItem>, "editor"> {
  const items: SlashCommandItem[] = [
    {
      id: "paragraph",
      label: "Paragraph",
      hint: "Aa",
      keywords: ["text", "plain", "p"],
      icon: <Pilcrow className="h-3.5 w-3.5" />,
      run: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).setParagraph().run(),
    },
    {
      id: "heading-1",
      label: "Heading 1",
      hint: "#",
      keywords: ["h1", "title", "big"],
      icon: <Heading1 className="h-3.5 w-3.5" />,
      run: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run(),
    },
    {
      id: "heading-2",
      label: "Heading 2",
      hint: "##",
      keywords: ["h2", "subtitle"],
      icon: <Heading2 className="h-3.5 w-3.5" />,
      run: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run(),
    },
    {
      id: "bulleted-list",
      label: "Bulleted list",
      keywords: ["ul", "bullet", "unordered"],
      icon: <List className="h-3.5 w-3.5" />,
      run: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleBulletList().run(),
    },
    {
      id: "numbered-list",
      label: "Numbered list",
      keywords: ["ol", "ordered", "number"],
      icon: <ListOrdered className="h-3.5 w-3.5" />,
      run: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
    },
    {
      id: "quote",
      label: "Quote",
      keywords: ["blockquote"],
      icon: <Quote className="h-3.5 w-3.5" />,
      run: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
    },
    {
      id: "code-block",
      label: "Code block",
      keywords: ["code", "pre", "snippet"],
      icon: <Code2 className="h-3.5 w-3.5" />,
      run: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
    },
    {
      id: "table",
      label: "Table",
      keywords: ["grid", "rows", "cols"],
      icon: <TableIcon className="h-3.5 w-3.5" />,
      run: ({ editor, range }) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
    },
    {
      id: "divider",
      label: "Section break",
      keywords: ["divider", "hr", "horizontal", "rule"],
      icon: <Minus className="h-3.5 w-3.5" />,
      run: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
    },
    {
      id: "emoji",
      label: "Emoji",
      keywords: ["smiley", "face", "icon"],
      icon: <Smile className="h-3.5 w-3.5" />,
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        onOpenEmoji();
      },
    },
    {
      id: "image",
      label: "Image",
      keywords: ["picture", "photo", "img"],
      icon: <ImageIcon className="h-3.5 w-3.5" />,
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        onOpenImage();
      },
    },
    {
      id: "mention",
      label: "Mention",
      hint: "@",
      keywords: ["tag", "user", "person"],
      icon: <AtSign className="h-3.5 w-3.5" />,
      run: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).insertContent("@").run(),
    },
    {
      id: "embed",
      label: "Embed link",
      keywords: ["link", "url", "iframe"],
      icon: <ExternalLink className="h-3.5 w-3.5" />,
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        onOpenEmbed();
      },
    },
  ];

  return {
    items: ({ query }) => {
      const q = query.toLowerCase().trim();
      if (!q) return items;
      return items.filter((item) => {
        if (item.label.toLowerCase().includes(q)) return true;
        return item.keywords?.some((k) => k.toLowerCase().includes(q)) ?? false;
      });
    },
    render: () => {
      let component: ReactRenderer<SlashMenuHandle> | null = null;
      let popup: TippyInstance | null = null;
      return {
        onStart: (props) => {
          component = new ReactRenderer(SlashMenu, { props, editor: props.editor });
          if (!props.clientRect) return;
          popup = tippy(document.body, {
            getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start",
            theme: "mention",
          });
        },
        onUpdate: (props) => {
          component?.updateProps(props);
          popup?.setProps({
            getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
          });
        },
        onKeyDown: (props) => {
          if (props.event.key === "Escape") {
            popup?.hide();
            return true;
          }
          return component?.ref?.onKeyDown(props.event) ?? false;
        },
        onExit: () => {
          popup?.destroy();
          component?.destroy();
          popup = null;
          component = null;
        },
      };
    },
  };
}

export function RichTextEditor({
  value,
  onChange,
  onBlur,
  members,
  placeholder,
  className,
  autoFocus,
  minHeight = "80px",
}: Props) {
  // Toolbar visibility = editor focused OR any sub-UI open. Tracking each
  // popover/dropdown lets the toolbar stay visible while the user interacts
  // with portal'd menus (which would otherwise blur the editor).
  const [editorFocused, setEditorFocused] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const showToolbar =
    editorFocused || insertOpen || linkOpen || imageOpen || embedOpen || emojiOpen;

  // See buildMentionSuggestion — editor closures freeze at mount, so we
  // route the latest members through a ref.
  const membersRef = useRef<Profile[]>(members);
  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Image.configure({
        HTMLAttributes: { class: "tiptap-image" },
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Mention.configure({
        HTMLAttributes: { class: "mention", "data-type": "mention" },
        renderHTML({ options, node }) {
          return [
            "span",
            {
              ...options.HTMLAttributes,
              "data-id": String(node.attrs.id),
              "data-label": String(node.attrs.label ?? ""),
            },
            `@${node.attrs.label ?? node.attrs.id}`,
          ];
        },
        suggestion: buildMentionSuggestion(membersRef),
      }),
      SlashCommand.configure({
        suggestion: buildSlashSuggestion({
          onOpenImage: () => setImageOpen(true),
          onOpenEmbed: () => setEmbedOpen(true),
          onOpenEmoji: () => setEmojiOpen(true),
        }),
      }),
    ],
    content: value || "",
    autofocus: autoFocus ?? false,
    editorProps: {
      attributes: {
        class: "tiptap-content focus:outline-none",
        "data-placeholder": placeholder ?? "",
        style: `min-height: ${minHeight}`,
      },
    },
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
    onFocus: () => setEditorFocused(true),
    onBlur: ({ editor }) => {
      setEditorFocused(false);
      onBlur?.(editor.getHTML());
    },
  });

  // Keep editor content in sync if the parent value changes externally.
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  return (
    <div
      className={cn(
        "rounded-md border bg-background transition-colors",
        showToolbar ? "ring-1 ring-ring/40" : "",
        className
      )}
    >
      <EditorContent editor={editor} className="px-3 py-2" />
      {/* Toolbar stays mounted so it can transition in both directions.
          Wrapper handles the open/close animation; the toolbar itself owns
          its visual styling. */}
      <div
        aria-hidden={!showToolbar}
        className={cn(
          "overflow-hidden transition-[max-height,opacity,transform] duration-200 ease-out",
          showToolbar
            ? "max-h-[160px] opacity-100 translate-y-0"
            : "max-h-0 opacity-0 -translate-y-1 pointer-events-none"
        )}
      >
        <Toolbar
          editor={editor}
          insertOpen={insertOpen}
          setInsertOpen={setInsertOpen}
          linkOpen={linkOpen}
          setLinkOpen={setLinkOpen}
          imageOpen={imageOpen}
          setImageOpen={setImageOpen}
          embedOpen={embedOpen}
          setEmbedOpen={setEmbedOpen}
          emojiOpen={emojiOpen}
          setEmojiOpen={setEmojiOpen}
        />
      </div>
    </div>
  );
}

// Toolbar ---------------------------------------------------------------

type ToolbarProps = {
  editor: Editor;
  insertOpen: boolean;
  setInsertOpen: (v: boolean) => void;
  linkOpen: boolean;
  setLinkOpen: (v: boolean) => void;
  imageOpen: boolean;
  setImageOpen: (v: boolean) => void;
  embedOpen: boolean;
  setEmbedOpen: (v: boolean) => void;
  emojiOpen: boolean;
  setEmojiOpen: (v: boolean) => void;
};

function Toolbar({
  editor,
  insertOpen,
  setInsertOpen,
  linkOpen,
  setLinkOpen,
  imageOpen,
  setImageOpen,
  embedOpen,
  setEmbedOpen,
  emojiOpen,
  setEmojiOpen,
}: ToolbarProps) {
  return (
    <div
      // Prevent clicks on the toolbar's empty space from stealing focus
      // from the editor (each button also preventDefaults individually).
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) e.preventDefault();
      }}
      className="flex items-center gap-0.5 px-1 py-1 border-t bg-muted/30 flex-wrap"
    >
      <InsertMenu
        editor={editor}
        open={insertOpen}
        onOpenChange={setInsertOpen}
        onOpenImage={() => setImageOpen(true)}
        onOpenEmoji={() => setEmojiOpen(true)}
        onOpenEmbed={() => setEmbedOpen(true)}
      />

      <Divider />

      <ToolbarButton
        label="Undo"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().chain().focus().undo().run()}
      >
        <Undo2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Redo"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().chain().focus().redo().run()}
      >
        <Redo2 className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Bulleted list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Divider />

      <Popover open={linkOpen} onOpenChange={setLinkOpen}>
        <PopoverTrigger asChild>
          <ToolbarButton
            label="Link"
            active={editor.isActive("link")}
            onClick={() => setLinkOpen(true)}
          >
            <Link2 className="h-3.5 w-3.5" />
          </ToolbarButton>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3">
          <LinkForm
            initialUrl={(editor.getAttributes("link").href as string | undefined) ?? ""}
            isOnLink={editor.isActive("link")}
            onSubmit={(url) => {
              const chain = editor.chain().focus();
              if (url) {
                chain.extendMarkRange("link").setLink({ href: url }).run();
              } else {
                chain.extendMarkRange("link").unsetLink().run();
              }
              setLinkOpen(false);
            }}
            onCancel={() => setLinkOpen(false)}
          />
        </PopoverContent>
      </Popover>

      <ToolbarButton
        label="Code"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Code block"
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code2 className="h-3.5 w-3.5" />
      </ToolbarButton>

      {/* Modal flows triggered from the Insert (+) menu. */}
      <UrlDialog
        open={imageOpen}
        onOpenChange={setImageOpen}
        title="Insert image"
        placeholder="https://example.com/photo.jpg"
        confirmLabel="Insert"
        onSubmit={(url) => {
          editor.chain().focus().setImage({ src: url }).run();
        }}
      />
      <UrlDialog
        open={embedOpen}
        onOpenChange={setEmbedOpen}
        title="Embed link"
        placeholder="https://…"
        confirmLabel="Insert"
        onSubmit={(url) => {
          editor
            .chain()
            .focus()
            .insertContent({
              type: "text",
              text: url,
              marks: [{ type: "link", attrs: { href: url } }],
            })
            .run();
        }}
      />
      <EmojiDialog
        open={emojiOpen}
        onOpenChange={setEmojiOpen}
        onSelect={(emoji) => {
          editor.chain().focus().insertContent(emoji).run();
          setEmojiOpen(false);
        }}
      />
    </div>
  );
}

// Insert (+) menu -------------------------------------------------------

function InsertMenu({
  editor,
  open,
  onOpenChange,
  onOpenImage,
  onOpenEmoji,
  onOpenEmbed,
}: {
  editor: Editor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenImage: () => void;
  onOpenEmoji: () => void;
  onOpenEmbed: () => void;
}) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Insert"
          className="h-7 w-7"
          onMouseDown={(e) => e.preventDefault()}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <MenuRow
          icon={<Pilcrow className="h-3.5 w-3.5" />}
          label="Paragraph"
          onSelect={() => editor.chain().focus().setParagraph().run()}
        />
        <MenuRow
          icon={<Heading1 className="h-3.5 w-3.5" />}
          label="Heading 1"
          onSelect={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        />
        <MenuRow
          icon={<Heading2 className="h-3.5 w-3.5" />}
          label="Heading 2"
          onSelect={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <DropdownMenuSeparator />
        <MenuRow
          icon={<List className="h-3.5 w-3.5" />}
          label="Bulleted list"
          onSelect={() => editor.chain().focus().toggleBulletList().run()}
        />
        <MenuRow
          icon={<ListOrdered className="h-3.5 w-3.5" />}
          label="Numbered list"
          onSelect={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <MenuRow
          icon={<Quote className="h-3.5 w-3.5" />}
          label="Quote"
          onSelect={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <MenuRow
          icon={<Code2 className="h-3.5 w-3.5" />}
          label="Code block"
          onSelect={() => editor.chain().focus().toggleCodeBlock().run()}
        />
        <DropdownMenuSeparator />
        <MenuRow
          icon={<TableIcon className="h-3.5 w-3.5" />}
          label="Table"
          onSelect={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
        />
        <MenuRow
          icon={<Minus className="h-3.5 w-3.5" />}
          label="Section break"
          onSelect={() => editor.chain().focus().setHorizontalRule().run()}
        />
        <MenuRow
          icon={<Smile className="h-3.5 w-3.5" />}
          label="Emoji"
          onSelect={onOpenEmoji}
        />
        <MenuRow
          icon={<ImageIcon className="h-3.5 w-3.5" />}
          label="Image"
          onSelect={onOpenImage}
        />
        <MenuRow
          icon={<AtSign className="h-3.5 w-3.5" />}
          label="Mention"
          onSelect={() => editor.chain().focus().insertContent("@").run()}
        />
        <MenuRow
          icon={<ExternalLink className="h-3.5 w-3.5" />}
          label="Embed link"
          onSelect={onOpenEmbed}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuRow({
  icon,
  label,
  onSelect,
}: {
  icon: ReactNode;
  label: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem onSelect={onSelect} className="gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      {label}
    </DropdownMenuItem>
  );
}

// Toolbar primitives ----------------------------------------------------

function Divider() {
  return <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />;
}

function ToolbarButton({
  label,
  active,
  onClick,
  disabled,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onMouseDown={(e) => e.preventDefault()} // keep editor focused
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn("h-7 w-7", active && "bg-accent text-accent-foreground")}
    >
      {children}
    </Button>
  );
}

// Link form (popover content) ------------------------------------------

function LinkForm({
  initialUrl,
  isOnLink,
  onSubmit,
  onCancel,
}: {
  initialUrl: string;
  isOnLink: boolean;
  onSubmit: (url: string) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState(initialUrl);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(normalizeUrl(url));
      }}
      className="space-y-2"
    >
      <Label htmlFor="link-url" className="text-xs">
        URL
      </Label>
      <Input
        id="link-url"
        autoFocus
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://…"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      <div className="flex items-center justify-end gap-2 pt-1">
        {isOnLink && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSubmit("")}
          >
            Remove
          </Button>
        )}
        <Button type="submit" size="sm" disabled={!url.trim()}>
          Save
        </Button>
      </div>
    </form>
  );
}

// URL dialog (image, embed) --------------------------------------------

function UrlDialog({
  open,
  onOpenChange,
  title,
  placeholder,
  confirmLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  placeholder: string;
  confirmLabel: string;
  onSubmit: (url: string) => void;
}) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (open) setUrl("");
  }, [open]);

  const submit = () => {
    const trimmed = normalizeUrl(url);
    if (!trimmed) return;
    onSubmit(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-3"
        >
          <Input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={placeholder}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!url.trim()}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Emoji dialog ----------------------------------------------------------

function EmojiDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (emoji: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 w-fit max-w-none border-0 shadow-xl">
        <EmojiPicker
          onEmojiClick={(data) => onSelect(data.emoji)}
          emojiStyle={EmojiStyle.NATIVE}
          theme={EmojiTheme.AUTO}
          searchPlaceholder="Search emojis…"
          previewConfig={{ showPreview: false }}
          width={340}
          height={400}
        />
      </DialogContent>
    </Dialog>
  );
}

// Helpers ---------------------------------------------------------------

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^javascript:/i.test(trimmed)) return "";
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !trimmed.startsWith("/")) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

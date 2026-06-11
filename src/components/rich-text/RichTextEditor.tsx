import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import { EditorContent, ReactRenderer, useEditor, type Editor } from "@tiptap/react";
import { toast } from "sonner";
import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { Plugin } from "@tiptap/pm/state";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
// Image is brought in via our extended EditorImage below (adds the
// hover download/delete overlay as a React NodeView).
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
  LayoutGrid,
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
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

import { MentionList, type MentionListHandle, type MentionItem } from "./MentionList";
import { SlashCommand, type SlashCommandPayload } from "./SlashCommandExtension";
import { SlashMenu, type SlashItem, type SlashMenuHandle } from "./SlashMenu";
import { BannerNode } from "./BannerNode";
import { EditorImage } from "./EditorImage";
import { BannerPicker, type AnchorTarget as BannerAnchor } from "./BannerPicker";
import { InlineFileNode } from "./InlineFileNode";
import { CopyDimensionsOverlay } from "./CopyDimensionsOverlay";
import type { Banner } from "./bannerCatalog";

type BannerPickerState = {
  open: boolean;
  anchor: BannerAnchor | null;
  initialFilter: string;
};

type Props = {
  value: string;
  onChange?: (html: string) => void;
  onBlur?: (html: string) => void;
  members: Profile[];
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  minHeight?: string;
  /** When provided, the Image action picks a file (instead of asking for a
   *  URL), and pasted/dropped image files are uploaded automatically. The
   *  callback returns the URL to embed in the editor's `<img src>`. */
  onUploadImage?: (file: File) => Promise<string>;
  /** When provided, non-image files pasted or dropped into the editor are
   *  uploaded via this callback and inserted as clickable links inline. */
  onUploadFile?: (file: File) => Promise<string>;
  /** Fires on Cmd+Enter (Ctrl+Enter on non-Mac). Used by composers like
   *  the comment box to submit without reaching for the mouse. The editor
   *  passes the current HTML to the handler; if it returns false (or
   *  isn't provided) the keystroke falls through to TipTap's defaults. */
  onSubmit?: (html: string) => void;
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
  onOpenBanners,
}: {
  onOpenImage: () => void;
  onOpenEmbed: () => void;
  onOpenEmoji: () => void;
  onOpenBanners: (initialFilter: string) => void;
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
      // NB: deleteRange WITHOUT .focus() so the picker that opens next
      // can take focus on its own. Calling editor.chain().focus()
      // before onOpenEmoji() raced the EmojiDialog's auto-focused
      // search input and the editor won, making the picker feel
      // unresponsive.
      run: ({ editor, range }) => {
        editor.chain().deleteRange(range).run();
        onOpenEmoji();
      },
    },
    {
      id: "image",
      label: "Image",
      keywords: ["picture", "photo", "img"],
      icon: <ImageIcon className="h-3.5 w-3.5" />,
      run: ({ editor, range }) => {
        editor.chain().deleteRange(range).run();
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
        editor.chain().deleteRange(range).run();
        onOpenEmbed();
      },
    },
  ];

  // Builds the "Banners" entry. The `query` is baked into `run` so that
  // `/banners 800` opens the picker with "800" pre-filled — we can't get the
  // query inside `run` from the suggestion plugin otherwise.
  const buildBannersItem = (query: string): SlashCommandItem => {
    const q = query.trim();
    const filter = /^banners\b/i.test(q) ? q.replace(/^banners\s*/i, "") : "";
    return {
      id: "banners",
      label: "Banners",
      hint: "›",
      keywords: ["banner", "ad", "creative", "size", "dimension"],
      icon: <LayoutGrid className="h-3.5 w-3.5" />,
      run: ({ editor, range }) => {
        editor.chain().deleteRange(range).run();
        onOpenBanners(filter);
      },
    };
  };

  return {
    items: ({ query }) => {
      const q = query.toLowerCase().trim();
      const banners = buildBannersItem(query);
      // `/banners[…]` shortcut: always surface ONLY the Banners entry so
      // pressing Enter opens the sub-menu with the rest as a filter.
      if (q.startsWith("banners")) return [banners];
      if (!q) return [...items, banners];
      const matchesBanners =
        "banners".includes(q) ||
        banners.keywords?.some((k) => k.toLowerCase().includes(q));
      const filtered = items.filter((item) => {
        if (item.label.toLowerCase().includes(q)) return true;
        return item.keywords?.some((k) => k.toLowerCase().includes(q)) ?? false;
      });
      return matchesBanners ? [...filtered, banners] : filtered;
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
  onUploadImage,
  onUploadFile,
  onSubmit,
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
  const [bannerPicker, setBannerPicker] = useState<BannerPickerState>({
    open: false,
    anchor: null,
    initialFilter: "",
  });
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  // Wrapper ref so the banner picker can anchor outside the editor content
  // area (below the whole field) instead of at the cursor — that way the
  // picker doesn't cover pills the user has already inserted.
  const wrapperRef = useRef<HTMLDivElement>(null);

  const showToolbar =
    editorFocused ||
    insertOpen ||
    linkOpen ||
    imageOpen ||
    embedOpen ||
    emojiOpen ||
    bannerPicker.open;

  // Slash-command closures freeze at editor mount, so route the latest
  // banner-picker opener through a ref (same pattern as mentions / uploaders).
  // Both / and + flows anchor to the editor wrapper so the picker drops
  // below the whole field — never on top of pills the user has already
  // inserted.
  const openBannerPickerRef = useRef<(initialFilter: string) => void>(() => {});
  openBannerPickerRef.current = (initialFilter) => {
    const el = wrapperRef.current;
    if (!el) return;
    // Defer by one task so the click that triggered the open (typically
    // a SlashMenu item click — the Tippy popup tears down inline as
    // part of that same click) finishes propagating before Radix's
    // outside-click detector activates on the new popover. Without
    // this, the popover mounts mid-click, sees the still-bubbling
    // event as "outside the popover", and immediately closes itself —
    // which reads as a flicker on the user side.
    setTimeout(() => {
      setBannerPicker({
        open: true,
        anchor: { type: "element", element: el },
        initialFilter,
      });
    }, 0);
  };

  // See buildMentionSuggestion — editor closures freeze at mount, so we
  // route the latest members through a ref.
  const membersRef = useRef<Profile[]>(members);
  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  // Latest uploader through a ref for the same reason mentions does it: the
  // ProseMirror handlePaste/handleDrop closures are captured at mount.
  const uploadRef = useRef(onUploadImage);
  useEffect(() => {
    uploadRef.current = onUploadImage;
  }, [onUploadImage]);

  const fileUploadRef = useRef(onUploadFile);
  useEffect(() => {
    fileUploadRef.current = onUploadFile;
  }, [onUploadFile]);

  // Same ref pattern for onSubmit so the editorProps.handleKeyDown
  // closure (captured at mount) always sees the latest handler.
  const onSubmitRef = useRef(onSubmit);
  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  // Editor is created below; we keep a ref so the file picker change handler
  // (declared outside the useEditor call) can reach it.
  const editorRef = useRef<Editor | null>(null);

  /**
   * Routes a batch of pasted/dropped files. Images go to `onUploadImage`,
   * everything else to `onUploadFile`. Both run in parallel; once all
   * uploads settle we insert every successful one into the editor in a
   * SINGLE ProseMirror transaction (images as inline `<img>` nodes,
   * non-images as paragraph-wrapped clickable links). Doing it in one
   * transaction avoids the chained-command races that previously caused
   * only the first image to land.
   */
  const routeFiles = (files: File[]) => {
    const imageUploader = uploadRef.current;
    const fileUploader = fileUploadRef.current;

    const images: File[] = [];
    const others: File[] = [];
    files.forEach((file) => {
      if (isImage(file) && imageUploader) images.push(file);
      else if (fileUploader) others.push(file);
    });

    if (images.length === 0 && others.length === 0) return;

    void (async () => {
      const [imageResults, fileResults] = await Promise.all([
        images.length > 0 && imageUploader
          ? Promise.allSettled(
              images.map((file) =>
                toast
                  .promise(imageUploader(file), {
                    loading: `Uploading ${file.name}…`,
                    success: `${file.name} uploaded`,
                    error: (e: unknown) =>
                      e instanceof Error
                        ? e.message
                        : `Failed to upload ${file.name}`,
                  })
                  .unwrap()
              )
            )
          : Promise.resolve([] as PromiseSettledResult<string>[]),
        others.length > 0 && fileUploader
          ? Promise.allSettled(
              others.map((file) =>
                toast
                  .promise(fileUploader(file), {
                    loading: `Uploading ${file.name}…`,
                    success: `${file.name} uploaded`,
                    error: (e: unknown) =>
                      e instanceof Error
                        ? e.message
                        : `Failed to upload ${file.name}`,
                  })
                  .unwrap()
              )
            )
          : Promise.resolve([] as PromiseSettledResult<string>[]),
      ]);

      const imageUrls = imageResults
        .filter(
          (r): r is PromiseFulfilledResult<string> => r.status === "fulfilled"
        )
        .map((r) => r.value);
      const fileLinks: { url: string; name: string }[] = [];
      fileResults.forEach((r, i) => {
        if (r.status === "fulfilled") {
          fileLinks.push({ url: r.value, name: others[i]!.name });
        }
      });

      if (imageUrls.length === 0 && fileLinks.length === 0) return;

      const editor = editorRef.current;
      if (!editor) return;

      // Build one mixed content array: image nodes (inline) followed by
      // paragraph-wrapped inline-file nodes (each chip on its own line).
      // insertContent handles the mix in one transaction so successive
      // drops don't race the editor schema.
      const content: Record<string, unknown>[] = [
        ...imageUrls.map((url) => ({
          type: "image",
          attrs: { src: url },
        })),
        ...fileLinks.map(({ url, name }) => ({
          type: "paragraph",
          content: [
            {
              type: "inlineFile",
              attrs: { href: url, name },
            },
          ],
        })),
      ];

      editor.chain().focus().insertContent(content).run();
    })();
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
      }),
      Underline,
      Link.extend({
        // Keep a link mark's `href` in sync with the URL displayed
        // underneath it. TipTap's autolink only fires on initial
        // typing — editing already-linked text leaves the original
        // href pointing at the original URL, so "osta.ee" edited to
        // "okidoki.ee" still navigated to osta.ee. This plugin
        // re-checks each link mark after every transaction: if the
        // text under it parses as a URL and differs from the current
        // href, the href is rewritten. Non-URL text inside a link
        // mark (a deliberate custom-text link) is left alone — its
        // text doesn't match the URL pattern, so the plugin skips it.
        addProseMirrorPlugins() {
          const parent = this.parent?.() ?? [];
          return [
            ...parent,
            new Plugin({
              appendTransaction(_txs, oldState, newState) {
                if (newState.doc.eq(oldState.doc)) return null;
                const linkType = newState.schema.marks.link;
                if (!linkType) return null;

                const tr = newState.tr;
                let changed = false;

                newState.doc.descendants((node, pos) => {
                  if (!node.isText) return;
                  const linkMark = node.marks.find((m) => m.type === linkType);
                  if (!linkMark) return;

                  const text = node.text ?? "";
                  // URL with explicit protocol OR a bare domain like
                  // "osta.ee" / "sub.domain.co/path". Refuses spaces.
                  const looksLikeUrl =
                    /^https?:\/\/\S+$/.test(text) ||
                    /^[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?:\/\S*)?$/.test(text);
                  if (!looksLikeUrl) return;

                  const desiredHref = /^https?:\/\//.test(text)
                    ? text
                    : `https://${text}`;
                  if (desiredHref === linkMark.attrs.href) return;

                  // removeMark + addMark on the same range don't
                  // shift node positions, so we can reuse `pos` for
                  // multiple stale links in a single transaction.
                  const newMark = linkType.create({
                    ...linkMark.attrs,
                    href: desiredHref,
                  });
                  tr.removeMark(pos, pos + node.nodeSize, linkType);
                  tr.addMark(pos, pos + node.nodeSize, newMark);
                  changed = true;
                });

                return changed ? tr : null;
              },
            }),
          ];
        },
      }).configure({
        // Clicks on links open them in a new tab (target=_blank via the
        // HTMLAttributes below). Cursor placement at the link's edges
        // still works for editing, but clicking ON the link text itself
        // navigates — matches user expectation for both the description
        // editor and the comment composer.
        openOnClick: true,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      // EditorImage extends TipTap's Image with a React NodeView that
      // adds a hover-revealed Download (+ Delete) overlay — same
      // affordance the read-only InlineImage renderer offers.
      EditorImage.configure({
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
          onOpenImage: () => triggerImagePickerOrDialog(),
          onOpenEmbed: () => setEmbedOpen(true),
          onOpenEmoji: () => setEmojiOpen(true),
          onOpenBanners: (filter) => openBannerPickerRef.current(filter),
        }),
      }),
      BannerNode,
      InlineFileNode,
    ],
    content: value || "",
    autofocus: autoFocus ?? false,
    editorProps: {
      attributes: {
        class: "tiptap-content focus:outline-none",
        "data-placeholder": placeholder ?? "",
        style: `min-height: ${minHeight}`,
      },
      handleKeyDown: (_view, event) => {
        // Cmd+Enter (Mac) / Ctrl+Enter (Win/Linux) submits via the
        // host's onSubmit handler — used by the comment composer to
        // post without clicking the Post button. We only consume the
        // keystroke when an onSubmit is wired; otherwise it falls
        // through to TipTap's default Enter handling.
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          const handler = onSubmitRef.current;
          if (!handler) return false;
          event.preventDefault();
          handler(editorRef.current?.getHTML() ?? "");
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const hasUploader = !!uploadRef.current;
        const hasFileUploader = !!fileUploadRef.current;
        if (!hasUploader && !hasFileUploader) return false;

        const syncFiles = extractAllFiles(event.clipboardData);
        if (syncFiles.length === 0) return false;
        event.preventDefault();

        // Insert sync files immediately. Images go inline; everything else
        // is uploaded and linked inline as well.
        routeFiles(syncFiles);

        // Async fallback for browsers that expose more via clipboard.read().
        void (async () => {
          try {
            const asyncFiles = await readClipboardImages();
            if (asyncFiles.length > syncFiles.length) {
              routeFiles(asyncFiles.slice(syncFiles.length));
            }
          } catch {
            // ignore — we already routed syncFiles
          }
        })();

        // Surface the macOS Chrome paste limitation when we can detect it:
        // text/uri-list exposes the FULL list of copied paths even when
        // .files was truncated. We can't fetch file:// URIs from a webpage,
        // so the only honest thing to do is tell the user.
        const uriCount = uriListFileCount(event.clipboardData);
        if (uriCount > syncFiles.length) {
          toast.info(
            `Your browser only let us paste ${syncFiles.length} of ${uriCount} files. Drag from Finder to add the rest.`
          );
        }
        return true;
      },
      handleDrop: (_view, event) => {
        // File drops are handled by the wrapper's React onDrop below — it's
        // a more deterministic path that doesn't depend on ProseMirror's
        // internal drop processing. We still claim the drop here (return
        // true) for file drops so ProseMirror skips its own default
        // (which would insert blob-URL <img> tags we don't control).
        const dt = event.dataTransfer;
        const hasFiles =
          (dt?.files?.length ?? 0) > 0 ||
          Array.from(dt?.items ?? []).some((i) => i.kind === "file");
        if (!hasFiles) return false;
        const hasUploader = !!uploadRef.current;
        const hasFileUploader = !!fileUploadRef.current;
        if (!hasUploader && !hasFileUploader) return false;
        // Don't process here — the wrapper handler does. Just suppress
        // ProseMirror's default. preventDefault on the event also stops
        // the browser from navigating to the file.
        event.preventDefault();
        return true;
      },
    },
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
    onFocus: () => setEditorFocused(true),
    onBlur: ({ editor }) => {
      setEditorFocused(false);
      onBlur?.(editor.getHTML());
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Image button → file picker when uploader is configured, else URL dialog.
  const triggerImagePickerOrDialog = () => {
    if (uploadRef.current) imageFileInputRef.current?.click();
    else setImageOpen(true);
  };

  // Keep editor content in sync if the parent value changes externally.
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  const hasUploader = !!onUploadImage;
  const acceptsAnyFile = hasUploader || !!onUploadFile;

  return (
    <div
      ref={wrapperRef}
      className={cn(
        // `overflow-hidden` is what clips the sticky toolbar's flat
        // bottom edge to the wrapper's rounded corners. Without it the
        // toolbar's bg paints past the rounded border and the bottom
        // corners read as square.
        "relative overflow-hidden rounded-md border bg-background transition-colors",
        showToolbar ? "ring-1 ring-ring/40" : "",
        isDraggingOver && "ring-2 ring-primary/60",
        className
      )}
      onDragEnter={(e) => {
        if (!acceptsAnyFile) return;
        if (!hasAnyFiles(e.dataTransfer)) return;
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragOver={(e) => {
        if (!acceptsAnyFile) return;
        if (!hasAnyFiles(e.dataTransfer)) return;
        e.preventDefault();
      }}
      onDragLeave={(e) => {
        // Only clear when leaving the wrapper itself, not when entering a child.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setIsDraggingOver(false);
      }}
      onDrop={(e) => {
        setIsDraggingOver(false);
        if (!acceptsAnyFile) return;
        const files = extractAllFiles(e.dataTransfer);
        if (files.length === 0) return;
        e.preventDefault();
        routeFiles(files);
      }}
    >
      {hasUploader && (
        <input
          ref={imageFileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) routeFiles(files);
            if (imageFileInputRef.current) imageFileInputRef.current.value = "";
          }}
        />
      )}
      <EditorContent editor={editor} className="px-3 py-2" />
      <CopyDimensionsOverlay editor={editor} />
      <BannerPicker
        open={bannerPicker.open}
        onOpenChange={(open) =>
          setBannerPicker((s) => ({ ...s, open }))
        }
        anchor={bannerPicker.anchor}
        initialFilter={bannerPicker.initialFilter}
        insertedIds={collectBannerIds(editor)}
        onInsert={(banner: Banner) => {
          // editor.commands (NOT chain().focus()) so the picker keeps focus
          // and stays open for another pick.
          editor.commands.insertBanner(banner.id);
        }}
      />
      {/* Toolbar stays mounted so it can transition in both directions.
          Wrapper handles the open/close animation; the toolbar itself owns
          its visual styling. */}
      <div
        aria-hidden={!showToolbar}
        className={cn(
          "sticky bottom-0 z-10 overflow-hidden transition-[max-height,opacity,transform] duration-200 ease-out",
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
          onTriggerImage={triggerImagePickerOrDialog}
          onOpenBanners={() => openBannerPickerRef.current("")}
        />
      </div>

      {isDraggingOver && (
        <div className="pointer-events-none absolute inset-0 rounded-md bg-primary/5 border-2 border-dashed border-primary/40 flex items-center justify-center text-xs font-medium text-primary">
          Drop files to upload
        </div>
      )}
    </div>
  );
}

/** Collects the bannerIds currently present in the editor doc. Used to mark
 *  already-inserted banners with a check mark in the picker. */
function collectBannerIds(editor: Editor | null): Set<string> {
  const ids = new Set<string>();
  if (!editor) return ids;
  editor.state.doc.descendants((node) => {
    if (node.type.name === "banner" && node.attrs.bannerId) {
      ids.add(node.attrs.bannerId);
    }
    return true;
  });
  return ids;
}

function hasAnyFiles(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  // `files` is only populated on drop, not dragenter/dragover. Use `items`
  // during the drag and fall back to `files` once we have them.
  if (dt.items && dt.items.length > 0) {
    return Array.from(dt.items).some((item) => item.kind === "file");
  }
  return (dt.files?.length ?? 0) > 0;
}

/**
 * Pull every file out of a clipboard or drag DataTransfer (any MIME type).
 * Reads both `dt.files` and `dt.items` and returns whichever list has more
 * entries — on macOS Chrome multi-file paste, one of the two is usually
 * truncated but the other is complete.
 */
function extractAllFiles(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  const fromFiles = Array.from(dt.files ?? []);
  const fromItems: File[] = [];
  Array.from(dt.items ?? []).forEach((item) => {
    if (item.kind !== "file") return;
    const f = item.getAsFile();
    if (f) fromItems.push(f);
  });
  return fromItems.length > fromFiles.length ? fromItems : fromFiles;
}

function isImage(f: File): boolean {
  return f.type.startsWith("image/");
}

/**
 * Returns the count of file URIs present in the clipboard's text/uri-list,
 * which macOS Chrome populates with the FULL list of copied files even when
 * `clipboardData.files` is truncated to one. We use this purely to detect
 * the truncation and surface a hint to the user — we can't fetch local
 * file:// URIs from a webpage.
 */
function uriListFileCount(dt: DataTransfer | null): number {
  if (!dt) return 0;
  const list = dt.getData("text/uri-list") ?? "";
  if (!list) return 0;
  return list
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith("#"))
    .length;
}

/**
 * Async fallback that uses the modern Clipboard API. Some browsers surface
 * additional clipboard items here that aren't visible in the ClipboardEvent
 * synchronously — notably multi-file paste from Finder on macOS Chrome.
 * Throws if the API isn't available or the read is denied.
 */
async function readClipboardImages(): Promise<File[]> {
  if (!navigator.clipboard?.read) throw new Error("Clipboard API not available");
  const items = await navigator.clipboard.read();
  const files: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    for (const type of item.types) {
      if (!type.startsWith("image/")) continue;
      const blob = await item.getType(type);
      const ext = (type.split("/")[1] ?? "png").split("+")[0]; // svg+xml → svg
      files.push(
        new File([blob], `pasted-${i + 1}.${ext}`, {
          type,
          lastModified: Date.now(),
        })
      );
    }
  }
  return files;
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
  onTriggerImage: () => void;
  onOpenBanners: () => void;
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
  onTriggerImage,
  onOpenBanners,
}: ToolbarProps) {
  // On mobile, keep only the first 6 icons (Insert, Undo, Redo, Bold, Italic,
  // Underline); the rest are hidden to avoid the toolbar wrapping to multiple
  // rows. The Insert (+) menu still reaches images/emoji/embeds/banners.
  const isMobile = useIsMobile();
  return (
    <div
      // Prevent clicks on the toolbar's empty space from stealing focus
      // from the editor (each button also preventDefaults individually).
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) e.preventDefault();
      }}
      className="flex items-center gap-0.5 px-1 py-1 border-t bg-[#F5F7FA] flex-wrap"
    >
      <InsertMenu
        editor={editor}
        open={insertOpen}
        onOpenChange={setInsertOpen}
        onOpenImage={onTriggerImage}
        onOpenEmoji={() => setEmojiOpen(true)}
        onOpenEmbed={() => setEmbedOpen(true)}
        onOpenBanners={onOpenBanners}
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
      {/* Icons 7+ — hidden on mobile (only the first 6 show there). */}
      {!isMobile && (
        <>
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
        </>
      )}

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
  onOpenBanners,
}: {
  editor: Editor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenImage: () => void;
  onOpenEmoji: () => void;
  onOpenEmbed: () => void;
  onOpenBanners: () => void;
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
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        className="w-56"
        // Suppress Radix's default "focus the trigger button on close"
        // behavior. We don't actively grab focus here either: every
        // inline action item below already runs `editor.chain().focus().X()`
        // (so the editor stays focused for those), and the picker items
        // (Image / Emoji / Embed / Banners) let the picker that opens
        // take focus on its own. An explicit `editor.commands.focus()`
        // call here would race the BannerPicker's auto-focused search
        // input and steal focus from it — that's why Banners "didn't
        // work" after the +menu change.
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
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
        <DropdownMenuSeparator />
        <MenuRow
          icon={<LayoutGrid className="h-3.5 w-3.5" />}
          label="Banners"
          // BannerPicker auto-focuses its search input on open. We
          // intentionally do NOT call editor.commands.focus() here —
          // that would compete with the picker for focus and (combined
          // with the dropdown's onCloseAutoFocus) hand focus back to
          // the editor before the picker mounts.
          onSelect={onOpenBanners}
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

// `forwardRef` is required because this component is used as a Radix
// `<PopoverTrigger asChild>` child (link/image/embed/banner popovers), and
// Radix's Slot needs to thread a ref through to the underlying button to
// position the popover. Without forwardRef, the dev console fills with
// "Function components cannot be given refs" warnings.
const ToolbarButton = forwardRef<
  HTMLButtonElement,
  {
    label: string;
    active?: boolean;
    onClick?: () => void;
    disabled?: boolean;
    children: React.ReactNode;
  } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">
>(function ToolbarButton(
  { label, active, onClick, disabled, children, ...rest },
  ref
) {
  return (
    <Button
      ref={ref}
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
      {...rest}
    >
      {children}
    </Button>
  );
});

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

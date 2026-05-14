import { createElement, type ReactNode } from "react";

/**
 * Converts the rendered (already-sanitized) HTML string into a React tree.
 * Used by RichTextContent so we can swap out `<img>` for a React component
 * (with hover controls) instead of rendering the raw `<img>` tag.
 *
 * Supports the same tag set RichTextContent's DOMPurify allow-list permits.
 * Unknown attributes fall through unchanged so anchors, table spans, and
 * mention metadata survive intact.
 */
export function htmlToReact(
  html: string,
  renderImage: (props: ImgProps, key: string) => ReactNode,
  renderLink?: (
    props: AProps,
    key: string,
    children: ReactNode
  ) => ReactNode | undefined
): ReactNode {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  return Array.from(doc.body.childNodes).map((node, i) =>
    convertNode(node, String(i), renderImage, renderLink)
  );
}

export type ImgProps = {
  src: string;
  alt?: string;
  className?: string;
};

export type AProps = {
  href?: string;
  className?: string;
  target?: string;
  rel?: string;
};

const ATTR_MAP: Record<string, string> = {
  class: "className",
  colspan: "colSpan",
  rowspan: "rowSpan",
  for: "htmlFor",
  tabindex: "tabIndex",
};

const VOID_TAGS = new Set(["br", "hr", "img"]);

function convertNode(
  node: Node,
  key: string,
  renderImage: (props: ImgProps, key: string) => ReactNode,
  renderLink?: (
    props: AProps,
    key: string,
    children: ReactNode
  ) => ReactNode | undefined
): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (tag === "img") {
    return renderImage(
      {
        src: el.getAttribute("src") ?? "",
        alt: el.getAttribute("alt") ?? undefined,
        className: el.getAttribute("class") ?? undefined,
      },
      key
    );
  }

  if (tag === "a" && renderLink) {
    const children = Array.from(el.childNodes).map((child, i) =>
      convertNode(child, `${key}.${i}`, renderImage, renderLink)
    );
    const overridden = renderLink(
      {
        href: el.getAttribute("href") ?? undefined,
        className: el.getAttribute("class") ?? undefined,
        target: el.getAttribute("target") ?? undefined,
        rel: el.getAttribute("rel") ?? undefined,
      },
      key,
      children
    );
    if (overridden !== undefined) return overridden;
  }

  const props: Record<string, unknown> = { key };
  for (const a of Array.from(el.attributes)) {
    const name = ATTR_MAP[a.name] ?? a.name;
    props[name] = a.value;
  }

  if (VOID_TAGS.has(tag)) {
    return createElement(tag, props);
  }

  const children = Array.from(el.childNodes).map((child, i) =>
    convertNode(child, `${key}.${i}`, renderImage, renderLink)
  );
  return createElement(tag, props, ...children);
}

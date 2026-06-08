import { type SVGProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Icons exported directly from the Vibecodin Figma file. Paths are pulled
 * verbatim from the design source; the only edits are:
 *   - `stroke="var(--stroke-0, …)"` → `stroke="currentColor"` so each icon
 *     inherits text colour from its parent.
 *   - `width`/`height` on the root are dropped — callers control size via
 *     Tailwind utilities on the `className` prop.
 *
 * Use these in place of `lucide-react` wherever the surface needs to match
 * the design 1:1. Lucide remains the fallback for icons not present in the
 * Figma frame (grip handles, dialog menu glyphs, etc.).
 */

type IconProps = Omit<SVGProps<SVGSVGElement>, "stroke" | "fill" | "viewBox"> & {
  className?: string;
};

function Svg24({
  className,
  strokeWidth = 2,
  children,
  ...rest
}: IconProps & { strokeWidth?: number; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

function Svg18({
  className,
  strokeWidth = 1.5,
  children,
  ...rest
}: IconProps & { strokeWidth?: number; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

// 01 — Bell (used for the sidebar "Inbox" nav row)
export function IconBell(props: IconProps) {
  return (
    <Svg24 {...props}>
      <path d="M10.268 21C10.4435 21.304 10.696 21.5565 11 21.732C11.3041 21.9075 11.6489 21.9999 12 21.9999C12.3511 21.9999 12.6959 21.9075 13 21.732C13.304 21.5565 13.5565 21.304 13.732 21" />
      <path d="M3.262 15.326C3.13136 15.4692 3.04515 15.6472 3.01386 15.8385C2.98256 16.0298 3.00752 16.226 3.08571 16.4034C3.16389 16.5807 3.29194 16.7316 3.45426 16.8375C3.61658 16.9434 3.80618 16.9999 4 17H20C20.1938 17.0001 20.3834 16.9438 20.5459 16.8381C20.7083 16.7324 20.8365 16.5817 20.9149 16.4045C20.9933 16.2273 21.0185 16.0311 20.9874 15.8398C20.9564 15.6485 20.8704 15.4703 20.74 15.327C19.41 13.956 18 12.499 18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 12.499 4.589 13.956 3.262 15.326Z" />
    </Svg24>
  );
}

// 02 — Circle with check (used for the sidebar "My tasks" nav row)
export function IconCircleCheck(props: IconProps) {
  return (
    <Svg24 {...props}>
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
      <path d="M9 12L11 14L15 10" />
    </Svg24>
  );
}

// 03 — Plus (next to "PROJECTS" heading — "create new project" button)
export function IconPlus(props: IconProps) {
  return (
    <Svg24 {...props}>
      <path d="M8 12H16" />
      <path d="M12 8V16" />
    </Svg24>
  );
}

// 04 — Chevron down (section collapse, workspace switcher, etc.)
export function IconChevronDown(props: IconProps) {
  return (
    <Svg24 {...props}>
      <path d="M6 9L12 15L18 9" />
    </Svg24>
  );
}

// 05 — Magnifying glass (search input)
export function IconSearch(props: IconProps) {
  return (
    <Svg24 {...props}>
      <path d="M21 21L16.66 16.66" />
      <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" />
    </Svg24>
  );
}

// 06 — Circled plus (used on the black "Add task" pill button)
export function IconCirclePlus(props: IconProps) {
  return (
    <Svg24 {...props}>
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
      <path d="M8 12H16" />
      <path d="M12 8V16" />
    </Svg24>
  );
}

// 07/15 — Three stacked horizontal lines, middle wider than outer
//   (the "Section" glyph — used on the "Add Section" pill AND on the
//   Section property row in the task panel)
export function IconSection(props: IconProps) {
  return (
    <Svg24 {...props}>
      <path d="M17 6H8" />
      <path d="M20 12H5" />
      <path d="M17 18H8" />
    </Svg24>
  );
}

// 09 — Empty circle (task-row checkbox in its unchecked state)
export function IconCircle(props: IconProps) {
  return (
    <Svg18 strokeWidth={1.25} {...props}>
      <path d="M9 16.5C13.1421 16.5 16.5 13.1421 16.5 9C16.5 4.85786 13.1421 1.5 9 1.5C4.85786 1.5 1.5 4.85786 1.5 9C1.5 13.1421 4.85786 16.5 9 16.5Z" />
    </Svg18>
  );
}

// 10 — Three horizontal dots (detail panel "More actions" menu)
export function IconMoreHorizontal(props: IconProps) {
  return (
    <Svg24 {...props}>
      <path d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z" />
      <path d="M19 13C19.5523 13 20 12.5523 20 12C20 11.4477 19.5523 11 19 11C18.4477 11 18 11.4477 18 12C18 12.5523 18.4477 13 19 13Z" />
      <path d="M5 13C5.55228 13 6 12.5523 6 12C6 11.4477 5.55228 11 5 11C4.44772 11 4 11.4477 4 12C4 12.5523 4.44772 13 5 13Z" />
    </Svg24>
  );
}

// 11 — Diagonal cross (close button)
export function IconX(props: IconProps) {
  return (
    <Svg24 {...props}>
      <path d="M18 6L6 18" />
      <path d="M6 6L18 18" />
    </Svg24>
  );
}

// 12 — Person silhouette (Assignee property row)
export function IconUser(props: IconProps) {
  return (
    <Svg18 {...props}>
      <path d="M9 9.75C11.0711 9.75 12.75 8.07107 12.75 6C12.75 3.92893 11.0711 2.25 9 2.25C6.92893 2.25 5.25 3.92893 5.25 6C5.25 8.07107 6.92893 9.75 9 9.75Z" />
      <path d="M15 15.75C15 14.1587 14.3679 12.6326 13.2426 11.5074C12.1174 10.3821 10.5913 9.75 9 9.75C7.4087 9.75 5.88258 10.3821 4.75736 11.5074C3.63214 12.6326 3 14.1587 3 15.75" />
    </Svg18>
  );
}

// 13 — Calendar grid (Due Date property row)
export function IconCalendar(props: IconProps) {
  return (
    <Svg18 {...props}>
      <path d="M6 1.5V4.5" />
      <path d="M12 1.5V4.5" />
      <path d="M14.25 3H3.75C2.92157 3 2.25 3.67157 2.25 4.5V15C2.25 15.8284 2.92157 16.5 3.75 16.5H14.25C15.0784 16.5 15.75 15.8284 15.75 15V4.5C15.75 3.67157 15.0784 3 14.25 3Z" />
      <path d="M2.25 7.5H15.75" />
      <path d="M6 10.5H6.0075" />
      <path d="M9 10.5H9.0075" />
      <path d="M12 10.5H12.0075" />
      <path d="M6 13.5H6.0075" />
      <path d="M9 13.5H9.0075" />
      <path d="M12 13.5H12.0075" />
    </Svg18>
  );
}

// 14 — Flag (Priority property row)
export function IconFlag(props: IconProps) {
  return (
    <Svg18 {...props}>
      <path d="M3 16.5V3C3 2.88357 3.02711 2.76873 3.07918 2.66459C3.13125 2.56045 3.20685 2.46986 3.3 2.4C4.07893 1.8158 5.02633 1.5 6 1.5C8.25 1.5 9.75 3 11.4998 3C12.4998 3 13.2665 2.8 13.8 2.4C13.9114 2.31643 14.0439 2.26554 14.1826 2.25303C14.3214 2.24052 14.4608 2.26689 14.5854 2.32918C14.71 2.39147 14.8148 2.48722 14.888 2.6057C14.9612 2.72418 15 2.86072 15 3V10.5C15 10.6164 14.9729 10.7313 14.9208 10.8354C14.8687 10.9396 14.7931 11.0301 14.7 11.1C13.9211 11.6842 12.9737 12 12 12C9.75 12 8.25 10.5 6 10.5C4.89309 10.5 3.82502 10.908 3 11.646" />
    </Svg18>
  );
}

// 16 — Speech bubble (Comments header)
export function IconMessageCircle(props: IconProps) {
  return (
    <Svg18 {...props}>
      <path d="M2.3145 13.1318C2.37883 12.8395 2.35428 12.5347 2.244 12.2565C1.47658 10.6642 1.29619 8.85205 1.73467 7.13973C2.17315 5.42741 3.20231 3.92497 4.64058 2.8975C6.07885 1.87004 7.8338 1.38357 9.59579 1.52392C11.3578 1.66428 13.0136 2.42244 14.2711 3.66465C15.5285 4.90685 16.3069 6.55327 16.4687 8.31341C16.6306 10.0736 16.1656 11.8343 15.1558 13.285C14.146 14.7357 12.6562 15.7832 10.9494 16.2425C9.24252 16.7019 7.42829 16.5437 5.82675 15.7958C5.5639 15.696 5.27829 15.672 5.0025 15.7267L2.44275 16.4752C2.31927 16.508 2.18947 16.5087 2.06565 16.4772C1.94183 16.4458 1.8281 16.3832 1.73525 16.2955C1.6424 16.2077 1.5735 16.0977 1.53508 15.9759C1.49667 15.854 1.49001 15.7244 1.51575 15.5992L2.3145 13.1318Z" />
    </Svg18>
  );
}

// 18 — Diagonal chain link (header "Copy task link" action)
export function IconLink(props: IconProps) {
  return (
    <Svg18 {...props}>
      <path d="M7.5 9.74997C7.82209 10.1806 8.23302 10.5369 8.70491 10.7947C9.17681 11.0525 9.69863 11.2058 10.235 11.2442C10.7713 11.2826 11.3097 11.2052 11.8135 11.0173C12.3173 10.8294 12.7748 10.5353 13.155 10.155L15.405 7.90497C16.0881 7.19772 16.4661 6.25046 16.4575 5.26722C16.449 4.28398 16.0546 3.34343 15.3593 2.64815C14.664 1.95287 13.7235 1.55849 12.7403 1.54995C11.757 1.5414 10.8098 1.91938 10.1025 2.60247L8.8125 3.88497" />
      <path d="M10.5001 8.24999C10.1781 7.81939 9.76713 7.4631 9.29524 7.20528C8.82334 6.94746 8.30152 6.79415 7.76516 6.75574C7.2288 6.71732 6.69046 6.79471 6.18664 6.98265C5.68282 7.17059 5.22531 7.46468 4.84515 7.84499L2.59515 10.095C1.91206 10.8022 1.53408 11.7495 1.54262 12.7327C1.55117 13.716 1.94555 14.6565 2.64083 15.3518C3.33611 16.0471 4.27666 16.4415 5.2599 16.45C6.24313 16.4586 7.19039 16.0806 7.89765 15.3975L9.18015 14.115" />
    </Svg18>
  );
}

// 19 — Outward-pointing corner arrows (header "Expand to fullscreen" action)
export function IconMaximize(props: IconProps) {
  return (
    <Svg18 {...props}>
      <path d="M11.25 2.25H15.75V6.75" />
      <path d="M15.75 2.25L10.5 7.5" />
      <path d="M2.25 15.75L7.5 10.5" />
      <path d="M6.75 15.75H2.25V11.25" />
    </Svg18>
  );
}

// 20 — Inward-pointing corner arrows (counterpart to IconMaximize for the
//   "collapse fullscreen" state). Drawn from the same 18×18 grid by mirroring
//   the four corner-arrow paths inward.
export function IconMinimize(props: IconProps) {
  return (
    <Svg18 {...props}>
      <path d="M15.75 6.75H11.25V2.25" />
      <path d="M10.5 7.5L15.75 2.25" />
      <path d="M7.5 10.5L2.25 15.75" />
      <path d="M2.25 11.25H6.75V15.75" />
    </Svg18>
  );
}

// 17 — Smiley face + add (per-comment "react / add" action)
export function IconSmilePlus(props: IconProps) {
  return (
    <Svg18 {...props}>
      <path d="M16.5 8.25V9C16.4924 10.5137 16.0269 11.9898 15.1648 13.234C14.3026 14.4783 13.0842 15.4325 11.6695 15.9713C10.2549 16.5101 8.71033 16.6082 7.2389 16.2527C5.76747 15.8972 4.43804 15.1048 3.42539 13.9797C2.41274 12.8545 1.76426 11.4492 1.56521 9.9486C1.36617 8.44799 1.62587 6.92226 2.31017 5.572C2.99447 4.22174 4.07135 3.11016 5.39923 2.38338C6.7271 1.6566 8.24383 1.34864 9.75 1.5" />
      <path d="M6 10.5C6 10.5 7.125 12 9 12C10.875 12 12 10.5 12 10.5" />
      <path d="M6.75 6.75H6.7575" />
      <path d="M11.25 6.75H11.2575" />
      <path d="M12 3.75H16.5" />
      <path d="M14.25 1.5V6" />
    </Svg18>
  );
}

# Design System Audit

Inventory of every design token, primitive, and recurring pattern actually used in the codebase — extracted from `tailwind.config.js`, `src/index.css`, `src/components/ui/`, and the app's feature components. **Values below are pulled verbatim from code.** Approve or annotate this doc before I build anything in Figma.

---

## 1. Foundations

### 1.1 Color tokens (HSL, defined in `src/index.css:12-55`)

The app uses shadcn's HSL token system. These map to Tailwind utility classes like `bg-background`, `text-foreground`, `border-border`.

| Token | Light value (HSL) | Hex equivalent | Dark value (HSL) | Hex equivalent | Purpose |
|---|---|---|---|---|---|
| `--background` | `0 0% 100%` | `#FFFFFF` | `222.2 84% 4.9%` | `#0B0F19` | Page background |
| `--foreground` | `222.2 84% 0%` | `#000000` | `210 40% 100%` | `#FFFFFF` | Primary text |
| `--card` / `--popover` | `0 0% 100%` | `#FFFFFF` | `222.2 84% 4.9%` | `#0B0F19` | Surface |
| `--primary` | `222.2 47.4% 6%` | `#0A0F1A` | `210 40% 100%` | `#FFFFFF` | Solid fills (buttons) |
| `--primary-foreground` | `210 40% 100%` | `#FFFFFF` | `222.2 47.4% 6%` | `#0A0F1A` | Text on primary |
| `--secondary` | `210 40% 96.1%` | `#F1F5F9` | `217.2 32.6% 17.5%` | `#1E293B` | Secondary surface |
| `--muted` | `210 40% 96.1%` | `#F1F5F9` | `217.2 32.6% 17.5%` | `#1E293B` | Quiet surface |
| `--muted-foreground` | `215.4 16.3% 39%` | `#5A6373` | `215 20.2% 72%` | `#A8B0BF` | Quiet text |
| `--accent` | `210 40% 93%` | `#E2EAF1` | `217.2 32.6% 21%` | `#252F44` | Hover background |
| `--destructive` | `0 84.2% 55%` | `#EF4444` | `0 62.8% 36%` | `#962525` | Error / delete |
| `--border` / `--input` | `214.3 31.8% 84%` | `#CFD7E0` | `217.2 32.6% 23%` | `#293345` | Hairlines, form borders |
| `--ring` | `222.2 84% 0%` | `#000000` | `212.7 26.8% 88%` | `#D8DFE6` | Focus ring |

> ⚠️ **The app ships light-mode only today** — `.dark` is defined but no theme toggle is wired up. I'll create both modes as Figma variable modes but flag dark as "not currently used."

### 1.2 Hardcoded brand / utility colors (NOT yet tokenized)

These hex values appear repeatedly in `className` strings throughout `src/`. They should become tokens in Figma even though they're not tokens in code yet.

| Hex | Count | Role | Where used |
|---|---|---|---|
| `#708597` | 42+ | Muted text / icon (Delfi gray) | Labels, secondary text, icon fills, scrollbar thumb |
| `#DEDFE0` | 37+ | Hairline border | Inputs, dividers, section separators, sidebar edge |
| `#EDF2F4` | 35+ | Hover background | Sidebar rows, project rows, nav items, buttons |
| `#F6F9F9` | 10+ | Subtle surface tint | Done section background, selected row |
| `#00BC7C` | 7+ | Brand green / success | TaskCheckbox checked state + hover |
| `#3858F5` | 2 | Brand blue (Delfi) | Workspace switcher avatar pill |
| `#F5F7FA` | 1 | Quiet surface | (rare) |

**Project accent palette** (`src/features/projects/colors.ts:13-24`) — used for the `ProjectLetterPill`:

| Name | Hex |
|---|---|
| Pink | `#EC4899` |
| Red | `#EF4444` |
| Orange | `#F97316` |
| Yellow | `#FACC15` |
| Green | `#10B981` |
| Teal (default) | `#14B8A6` |
| Slate fallback | `#94A3B8` |

Project pills also accept any user-picked hex via the `ColorPicker` primitive.

### 1.3 Typography

**Font family** — Inter (with system fallback), set in `tailwind.config.js:5-88`. No other family.

**Sizes actually in use** (Tailwind defaults — no overrides):

| Class | Size / Line-height | Role | Occurrences |
|---|---|---|---|
| `text-xs` | 12px / 16px | Labels, captions, badges, due-date text | 75 |
| `text-sm` | 14px / 20px | Body, inputs, buttons, nav items, row titles | 108 |
| `text-base` | 16px / 24px | Input default (collapses to `sm` on md+) | 5 |
| `text-lg` | 18px / 28px | Section headers, modal titles | 17 |
| `text-xl` | 20px / 28px | Rare | 2 |
| `text-2xl` | 24px / 32px | Rare | 2 |

**Weights** — `font-normal` (400), `font-medium` (500), `font-semibold` (600), `font-bold` (700).

**Custom sizes** — only one: `text-[10px]` and `text-[11px]` for the tab-bar labels and avatar initials.

**Inferred typographic roles** (to be made Figma text styles):

| Role | Class combo | Used for |
|---|---|---|
| Heading L | `text-lg font-semibold` | Project name in header, modal titles, section names |
| Heading M | `text-sm font-semibold` | Sidebar section labels, "Done" header |
| Body | `text-sm font-normal` | Task titles in rows, dialog body |
| Body emphasis | `text-sm font-medium` | Nav items, buttons, sidebar links |
| Label / caption | `text-xs font-medium` | Column headers, "12 of 24 subtasks", form labels |
| Micro | `text-[10px] font-medium` | Bottom tab labels |
| Avatar initial | `text-[10px] font-semibold` (24px avatar) / `text-xs font-bold` (36px avatar) | Avatar fallbacks |

### 1.4 Spacing scale

Dominant scale is `4px` increments. **8px (`-2`) is the workhorse.**

| Class | Value | Use count (combined p/px/py/gap) |
|---|---|---|
| `*-1` | 4px | ~170 |
| `*-2` | 8px | ~270 ← dominant |
| `*-3` | 12px | ~40 |
| `*-4` | 16px | ~55 |
| `*-6` | 24px | ~20 |
| `*-8` | 32px | ~5 |

**Figma spacing tokens to create:** `space/1` (4px), `space/2` (8px), `space/3` (12px), `space/4` (16px), `space/6` (24px), `space/8` (32px).

### 1.5 Border radii

| Class | Value | Use count | Where |
|---|---|---|---|
| `rounded-sm` | 2px | 9 | Dropdown items, checkboxes |
| `rounded-md` | 6px | 49 | Buttons, inputs, popovers |
| `rounded-lg` | 8px | 22 | Cards, sheets, project rows |
| `rounded-2xl` | 16px | 1 | ProjectLetterPill |
| `rounded-full` | 9999px | 43 | Pills, avatars, TaskCheckbox |

### 1.6 Shadows / elevation

No standard Tailwind `shadow-md`/`shadow-lg`. All shadows are arbitrary values:

| Token name (proposed) | Value | Where |
|---|---|---|
| `elevation/header` | `0 2px 2px rgba(0,0,0,0.06)` | TaskListHeader, MobileTaskList sticky header |
| `elevation/popover` | `0 8px 24px rgba(0,0,0,0.12)` | TaskContextMenu |
| `elevation/inset` | `inset 0 2px 4px 0 rgba(0,0,0,0.1)` | TaskDetailPanel input wells, CommentList |
| `elevation/panel-edge` | `-12px 0 28px -16px rgba(0,0,0,0.18)` | Detail panel left-edge shadow when docked |

### 1.7 Breakpoints

- **Mobile cutoff:** `(max-width: 767px)` (`src/hooks/useIsMobile.ts:6`) — intentionally `md - 1px` so layout decisions never share a value with utility classes.
- **Tailwind prefixes in use:** `sm:` (≥640px), `md:` (≥768px). No `lg:`, `xl:`, `2xl:` usage.

For Figma: build at **375px** (mobile) and **1280px** (desktop) frames.

---

## 2. Component primitives (`src/components/ui/`)

All variants/sizes/states below are pulled from the actual source. **States not listed do not exist in code.**

### 2.1 Button (`button.tsx`)

| Aspect | Values |
|---|---|
| **Variants** | `default`, `destructive`, `outline`, `secondary`, `ghost`, `link` |
| **Sizes** | `default` (h-10, px-4, py-2), `sm` (h-9, px-3), `lg` (h-11, px-8), `icon` (h-10 w-10) |
| **States** | rest, hover (`bg-{variant}/90`), focus-visible (ring), disabled (`opacity-50`) |
| **Type** | `rounded-md text-sm font-medium`, transitions on all colors |
| **Icon slot** | `[&_svg]:size-4 [&_svg]:shrink-0` |

### 2.2 Input (`input.tsx`)

| Aspect | Values |
|---|---|
| **Variants** | none (single style) |
| **Size** | `h-10 w-full px-3 py-2` |
| **Type** | `text-base md:text-sm` (16px on mobile — iOS zoom prevention) |
| **Border** | `border border-input rounded-md` |
| **States** | rest, focus-visible (ring-2), disabled (opacity-50) |
| **File input slot** | borderless, `text-sm font-medium` |

### 2.3 Textarea (`textarea.tsx`)
Mirrors Input. `min-h-[80px]`.

### 2.4 Checkbox (`checkbox.tsx`) — generic square checkbox
| Aspect | Values |
|---|---|
| **Size** | `h-4 w-4` |
| **Shape** | `rounded-sm` (2px) |
| **Border** | `border border-primary` |
| **Checked** | `bg-primary text-primary-foreground` |
| **States** | rest, focus-visible (ring), disabled |

### 2.5 TaskCheckbox (`features/tasks/TaskCheckbox.tsx`) — round green checkbox
Distinct from the generic Checkbox; used in task lists and subtasks.

| Aspect | Values |
|---|---|
| **Shape** | `rounded-full` |
| **Border (rest)** | `border-[#708597]/60` |
| **Border (hover)** | `border-[#00BC7C]` |
| **Checked** | `bg-[#00BC7C] border-[#00BC7C] text-white` |
| **Icon** | inline SVG check, 1.5px round-cap stroke (18×18 viewBox) |

### 2.6 Badge (`badge.tsx`)

| Aspect | Values |
|---|---|
| **Variants** | `default`, `secondary`, `destructive`, `outline` |
| **Layout** | `inline-flex items-center rounded-full px-2.5 py-0.5` |
| **Type** | `text-xs font-semibold` |
| **States** | rest, hover (`bg-{variant}/80`) |

### 2.7 Avatar (`avatar.tsx`)

| Aspect | Values |
|---|---|
| **Default size** | `h-10 w-10` (overridable) |
| **Shape** | `rounded-full overflow-hidden` |
| **Fallback** | `bg-muted text-foreground` (colored via `avatarColor(id)` per-user) |
| **Used sizes in app** | 16, 20, 24, 36, 40 px |

### 2.8 Dialog & Alert Dialog (`dialog.tsx`, `alert-dialog.tsx`)

| Aspect | Values |
|---|---|
| **Overlay** | `fixed inset-0 z-50 bg-black/80` (fade in/out) |
| **Content** | `max-w-lg rounded-lg p-6 gap-4` (sm+), centered |
| **Animations** | fade + zoom-95 + slide |
| **Close X** | top-right, `rounded-sm opacity-70 hover:opacity-100` |
| **Footer** | `flex flex-col-reverse sm:flex-row` |

### 2.9 Sheet (`sheet.tsx`)

| Aspect | Values |
|---|---|
| **Variants (`side`)** | `top`, `bottom`, `left`, `right` |
| **Mobile sheets** | bottom, `rounded-t-2xl`, fills to 80vh |
| **Animations** | slide-in (500ms open, 300ms close) |
| **Padding** | `p-6` (overridable per use) |

### 2.10 Popover (`popover.tsx`)

| Aspect | Values |
|---|---|
| **Content** | `w-72 rounded-md border bg-popover p-4 shadow-md` |
| **sideOffset** | 4px default |
| **Animations** | fade + zoom-95 + slide |

### 2.11 Dropdown Menu (`dropdown-menu.tsx`)

| Aspect | Values |
|---|---|
| **Content** | `min-w-[8rem] rounded-md border p-1 shadow-md` |
| **Item** | `rounded-sm px-2 py-1.5 text-sm` |
| **Item focus** | `bg-accent text-accent-foreground` |
| **CheckboxItem/RadioItem** | `pl-8 pr-2 py-1.5`, 14×14 indicator |
| **Label** | `text-sm font-semibold` |
| **Separator** | `h-px bg-muted -mx-1 my-1` |
| **Shortcut** | `text-xs tracking-widest opacity-60 ml-auto` |

### 2.12 Select (`select.tsx`)

| Aspect | Values |
|---|---|
| **Trigger** | `h-10 w-full rounded-md border px-3 py-2 text-sm` |
| **Content** | dropdown-style with `rounded-md border bg-popover shadow-md` |
| **Item** | `rounded-sm py-1.5 pl-8 pr-2 text-sm` |

### 2.13 Calendar (`calendar.tsx`)

| Aspect | Values |
|---|---|
| **Cell size** | 32px (`--cell-size: 2rem`) |
| **Today** | `bg-accent text-accent-foreground rounded-md` |
| **Selected (single)** | `bg-primary text-primary-foreground` |
| **Range middle** | `bg-accent rounded-none` |
| **Range endpoints** | `bg-primary rounded-md` |
| **Outside month** | `text-muted-foreground` |

### 2.14 ColorPicker (`color-picker.tsx`)

| Aspect | Values |
|---|---|
| **Preset swatch** | `h-6 w-6 rounded-full`, active = `ring-2 ring-foreground` |
| **Canvas** | full-width × 160px tall, `rounded-md` |
| **Swatch preview** | `h-8 w-8 rounded-md border border-[#DEDFE0]` |
| **Hex input** | `font-mono uppercase`, maxLength 7 |

### 2.15 Skeleton (`skeleton.tsx`)
`animate-pulse rounded-md bg-muted`. No fixed size — set by caller.

### 2.16 Label (`label.tsx`)
`text-sm font-medium`. Disabled-peer dimming.

### 2.17 Sonner Toast (`sonner.tsx`)
Variants: success (green border + icon), error (destructive), default. Action button uses Button defaults; cancel uses muted.

### 2.18 Form (`form.tsx`)
- `FormItem` — `space-y-2`
- `FormLabel` — turns `text-destructive` on error
- `FormMessage` — `text-sm font-medium text-destructive`

---

## 3. App-level recurring patterns

These are *not* in `ui/` but appear repeatedly enough that they belong in the design system.

### 3.1 ProjectLetterPill (`features/projects/ProjectRow.tsx:51-67`)
Letter avatar for a project. `inline-flex h-6 w-6 rounded-2xl text-sm font-bold text-white`, background is the project's accent color. Used in: sidebar project rows, project view header, breadcrumbs.

### 3.2 ProjectRow (sidebar variant) (`features/projects/ProjectRow.tsx:69-193`)
`flex items-center gap-2 rounded-lg p-2 text-sm`. Active = `bg-[#EDF2F4] font-semibold`. Hover = `bg-[#EDF2F4]/60`. Right-aligned "more" button appears on hover.

### 3.3 Sidebar workspace switcher (`components/Sidebar.tsx:97-151`)
A `w-full rounded-lg p-2 hover:bg-[#EDF2F4]` button with: 24×24 colored letter pill (`#3858F5` default) + workspace name (`text-sm font-medium`) + chevron. Opens `w-60` dropdown.

### 3.4 Sidebar UserMenu (`components/Sidebar.tsx:258-303`)
36×36 avatar + name (`text-sm font-semibold`) + email (`text-xs text-[#708597]`). Same hover pattern as workspace switcher.

### 3.5 MobileBottomNav tab (`components/MobileNav.tsx`)
- Tab container: `flex-1 flex flex-col items-center justify-center gap-1`
- Icon: 24×24
- Label: `text-[10px] font-medium`
- Active = `text-foreground`; inactive = `text-[#708597]`
- Notification dot: `h-4 min-w-[16px] rounded-full text-[9px] font-bold`, positioned `absolute -top-1 -right-1`
- Container: `h-14 bg-white border-t border-[#DEDFE0]` with `pb-[env(safe-area-inset-bottom)]`

### 3.6 TaskRow (desktop, `features/tasks/TaskRow.tsx`)
`h-[38px]` row, `pl-4 pr-4`, top-border hairline `before:` pseudo-element at `#DEDFE0`. Cells: 18px checkbox + name (resizable width) + metadata strip (Publication / Assignee / Due / Created by / Priority, each fixed width). Selected = `bg-[#F6F9F9]`. Hover = `bg-[#F6F9F9]/60`.

### 3.7 TaskRow (mobile, `features/tasks/MobileTaskList.tsx`)
Min 44px, sticky-left Name cell (200px) + horizontal-scroll metadata cells (Publication 130, Assignee 140, Due 100). Same selected/tinted bg.

### 3.8 Task list section header
Inline group with chevron (18×18), title (`text-lg font-semibold`), count (`text-sm text-[#708597]`), hover-revealed more button (24×24).

### 3.9 TaskListHeader column cell (`features/tasks/TaskListHeader.tsx`)
`text-xs font-medium text-[#708597]` label + sort indicator (ArrowUp/Down, 12px) + filter dropdown chevron. Filter active = colored dot `h-1.5 w-1.5 rounded-full bg-primary`. Resize handle on right edge (1.5px wide, hover preview line via portal).

### 3.10 Done section dock (`features/tasks/TaskList.tsx:723-816`)
Bottom-docked block, `bg-[#F6F9F9] border-t border-[#DEDFE0]`, user-resizable height (drag handle on top edge, 1.5px). Header includes chevron + "Done" + count + sort dropdown.

### 3.11 Priority badge (`features/tasks/priority.ts` + `TaskRow.tsx:303`)
`Badge` variant=outline, `h-[18px] px-2 rounded-full text-[10px] font-semibold uppercase`. Color varies by level (low/medium/high — needs verification of exact hex per level).

### 3.12 Empty cell em-dash (`TaskRow.tsx:403`)
`text-muted-foreground/30 text-xs` em-dash. Reused as the "no value" state across publication/assignee/due cells.

### 3.13 Notification badge on tab icon
Two variants: filled (`bg-foreground text-background`) and outlined (`border bg-white text-[#708597]`). Both `h-4 min-w-[16px] rounded-full text-[9px] font-bold` with absolute positioning.

---

## 4. Iconography (`src/components/icons/figma.tsx`)

18 custom SVG icons, all from Figma exports, all using `currentColor`:

| Group | Icons | Size | Stroke |
|---|---|---|---|
| **Navigation (24×24)** | Bell, CircleCheck, Plus, ChevronDown, Search, CirclePlus, Section, MoreHorizontal, X | 24px | 2px |
| **Property / inline (18×18)** | User, Calendar, Flag, MessageCircle, Link, Maximize, Minimize, SmilePlus, Circle (1.25px stroke) | 18px | 1.5px |

All icons inherit `currentColor`, have `aria-hidden`, and `shrink-0`.

Plus the standalone `osano-logo` SVG (`h-[30px] w-auto` in the sidebar).

---

## 5. Proposed Figma file structure

After approval, I'll create:

**Page: Foundations**
- Color variables (light + dark modes) — semantic tokens + brand/utility hex
- Project accent swatches
- Typography styles (Heading L/M, Body, Body emphasis, Label, Micro, Avatar initial)
- Spacing scale (1–8)
- Border radius scale (sm, md, lg, 2xl, full)
- Elevation styles (header, popover, inset, panel-edge)

**Page: Components — Primitives**
- Button (6 variants × 4 sizes × rest/hover/focus/disabled)
- Input (rest/focus/disabled/error)
- Textarea
- Checkbox + TaskCheckbox
- Badge (4 variants)
- Avatar (5 sizes × image/fallback)
- Label
- Skeleton

**Page: Components — Overlays**
- Dialog / AlertDialog
- Sheet (4 sides)
- Popover
- Dropdown Menu (item, checkbox-item, radio-item, label, separator, shortcut)
- Select
- Calendar (today, selected, range, outside, disabled)
- ColorPicker
- Sonner Toast (default, success, error)

**Page: Components — App patterns**
- ProjectLetterPill (7 colors)
- ProjectRow (rest, hover, active)
- Sidebar (full assembly, mobile sheet variant)
- WorkspaceSwitcher trigger
- UserMenu trigger
- MobileBottomNav (5 tabs, with/without badges)
- TaskRow (desktop + mobile variants × rest/hover/selected/done)
- TaskList section header
- TaskListHeader column cell (rest, sort asc/desc, filter active, resize handle)
- Done section dock
- Priority badge (per level)
- Notification badge (filled + outlined)

**Page: Iconography**
- All 18 figma.tsx icons + osano logo

---

## 6. Known gaps / questions before building

1. **Dark mode** — defined in tokens but no UI toggle. Build it as a Figma mode anyway? (Lean **yes**, low cost.)
2. **Priority badge colors** — `priority.ts` defines per-level classes; I'll verify the exact tone for low/medium/high before drawing them.
3. **Empty / loading / error states** — patterns exist (skeleton in TaskList, "no tasks yet" message, toast errors) but aren't currently treated as named components. Worth elevating any?
4. **Project color picker** — should the 7 named swatches be Figma color *variables* (so they can be referenced by other components) or just static fills in the ColorPicker component?
5. **Mobile vs desktop split** — TaskRow has two distinct implementations. Build both as separate component variants in Figma, or keep just the mobile variant since that's the focus of recent work?

---

**Please review and tell me what to change/add before I start building in Figma.**

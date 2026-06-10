import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { IconSearch, IconX } from "@/components/icons/figma";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { resolveProjectColor } from "@/features/projects/colors";
import { useWorkspace } from "@/features/workspaces/useWorkspace";
import { useWorkspaceMembers } from "@/features/workspaces/useWorkspaceMembers";
import { avatarColor } from "@/lib/avatarColor";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

import {
  useGlobalTaskSearch,
  type SearchResultTask,
} from "./useGlobalTaskSearch";
import {
  useRecentTaskIds,
  useTasksByIds,
  type RecentTaskRow,
} from "./useRecentTasks";

type Row = SearchResultTask | RecentTaskRow;

/**
 * Full-screen mobile equivalent of [TaskSearchCombobox]. Uses the same
 * data hooks; differs only in chrome — input pinned to the top of the
 * sheet, results filling the rest of the viewport, no absolute-positioned
 * popover (which doesn't translate well inside a bottom-sheet portal).
 */
export function MobileTaskSearchSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { data: workspace } = useWorkspace();

  const recentIds = useRecentTaskIds();
  const { data: recentTasks = [] } = useTasksByIds(open && !query.trim() ? recentIds : []);
  const { data: searchResults = [], isFetching: searching } = useGlobalTaskSearch(
    query,
    open
  );
  const { data: members = [] } = useWorkspaceMembers(workspace?.id);

  // Reset the query whenever the sheet closes — reopening should start
  // on the recents list, not a stale search.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Autofocus the input on open. Small timeout lets the sheet's open
  // animation finish before the mobile keyboard pushes layout around.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, [open]);

  const showRecents = !query.trim();
  const rows: Row[] = showRecents ? recentTasks : searchResults;

  const select = (row: Row) => {
    const projectId = row.project?.id ?? row.project_id;
    if (!projectId) return;
    navigate(`/projects/${projectId}?task=${row.id}`);
    onOpenChange(false);
  };

  // modal=false keeps the bottom nav (rendered above this at a higher
  // z-index) visible and tappable, so Search behaves like the Inbox /
  // My Tasks pages — switching tabs closes it.
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        // `full` = fade in place (no slide-up); we stop it above the bottom
        // nav so the nav stays visible, matching the routed pages.
        side="full"
        style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
        // Override the SheetContent default close (top-right X) — we
        // render our own clear button inside the input and use a Cancel
        // text button. The built-in X overlaps the input otherwise.
        className="top-0 h-auto gap-0 p-0 rounded-none border-0 flex flex-col [&>button[aria-label='Close']]:hidden"
      >
        <SheetTitle className="sr-only">Search tasks</SheetTitle>

        <header className="shrink-0 flex items-center gap-2 px-4 pt-4 pb-3 border-b border-[#DEDFE0]">
          <div className="relative flex-1">
            <IconSearch
              className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#708597] pointer-events-none"
            />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="h-[41px] pl-11 pr-9 text-sm rounded-full border-[#DEDFE0] bg-white placeholder:text-[#708597] focus-visible:ring-1 focus-visible:ring-offset-0"
              aria-label="Search tasks"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 inline-flex items-center justify-center rounded-full text-[#708597] hover:text-foreground hover:bg-[#EDF2F4]"
                aria-label="Clear search"
              >
                <IconX className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="shrink-0 px-2 py-2 text-sm font-medium text-foreground"
          >
            Cancel
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="shrink-0 border-b border-[#DEDFE0] px-4 py-2 text-xs font-medium text-[#708597]">
            {showRecents
              ? recentIds.length === 0
                ? "Recents"
                : "Recents"
              : searching
                ? "Searching…"
                : rows.length === 0
                  ? "No tasks match"
                  : `${rows.length} result${rows.length === 1 ? "" : "s"}`}
          </div>
          <div className="px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {showRecents && recentIds.length === 0 && (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                Open a task and it'll show up here.
              </p>
            )}
            {rows.map((row) => (
              <MobileResultRow
                key={row.id}
                row={row}
                members={members}
                onSelect={() => select(row)}
              />
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MobileResultRow({
  row,
  members,
  onSelect,
}: {
  row: Row;
  members: Profile[];
  onSelect: () => void;
}) {
  const assignee = members.find((m) => m.id === row.assignee_id);
  const done = row.status === "done";
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-4 border-b border-[#DEDFE0] py-3 text-left transition-colors active:bg-[#EDF2F4]"
    >
      <Avatar className="h-9 w-9 shrink-0" title={assignee?.full_name ?? undefined}>
        <AvatarFallback className={cn("text-xs font-bold", avatarColor(assignee?.id))}>
          {initials(assignee?.full_name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {row.project && (
          <div className="flex items-center gap-1">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: resolveProjectColor(row.project.color) }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-black">
              {row.project.name}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <ResultCheck done={done} />
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm text-black",
              done && "text-black/70 line-through"
            )}
          >
            {row.title}
          </span>
        </div>
      </div>
    </button>
  );
}

/**
 * Presentational completion glyph for a search result. Mirrors
 * [TaskCheckbox] but is non-interactive (the whole row is the tap
 * target): a 1px #708597 hollow circle when open, a filled #00BC7C
 * circle with a white check when done.
 */
function ResultCheck({ done }: { done: boolean }) {
  return (
    <span
      className={cn(
        "grid h-[18px] w-[18px] shrink-0 place-content-center rounded-full border",
        done
          ? "border-[#00BC7C] bg-[#00BC7C] text-white"
          : "border-[#708597]/60 text-transparent"
      )}
      aria-hidden
    >
      <svg viewBox="0 0 18 18" className="h-full w-full" fill="none">
        <path
          d="M6.75 9L8.25 10.5L11.25 7.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

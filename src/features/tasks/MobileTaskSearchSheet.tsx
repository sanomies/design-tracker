import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Circle } from "lucide-react";

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        // Override the SheetContent default close (top-right X) — we
        // render our own clear button inside the input and use a Cancel
        // text button. The built-in X overlaps the input otherwise.
        className="h-[100dvh] gap-0 p-0 rounded-none border-0 flex flex-col [&>button[aria-label='Close']]:hidden"
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
              placeholder="Search tasks"
              className="h-10 pl-11 pr-9 text-sm rounded-full border-[#DEDFE0] bg-white placeholder:text-[#708597] focus-visible:ring-1 focus-visible:ring-offset-0"
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
          <div className="px-2 py-1 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {showRecents && recentIds.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
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
      className="w-full flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors active:bg-[#EDF2F4]"
    >
      {done ? (
        <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <Circle className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "truncate text-sm",
            done && "text-muted-foreground line-through"
          )}
        >
          {row.title}
        </div>
        {row.project && (
          <div className="inline-flex items-center gap-1 truncate text-xs text-muted-foreground">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: resolveProjectColor(row.project.color) }}
              aria-hidden
            />
            <span className="truncate">{row.project.name}</span>
          </div>
        )}
      </div>
      {assignee && (
        <Avatar className="h-6 w-6 shrink-0" title={assignee.full_name ?? undefined}>
          <AvatarFallback className={cn("text-[10px]", avatarColor(assignee.id))}>
            {initials(assignee.full_name)}
          </AvatarFallback>
        </Avatar>
      )}
    </button>
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

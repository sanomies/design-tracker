import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Circle, Search, X } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { avatarColor } from "@/lib/avatarColor";
import { cn } from "@/lib/utils";
import { projectColorClass } from "@/features/projects/colors";
import { useWorkspaceMembers } from "@/features/workspaces/useWorkspaceMembers";
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
 * Global task search. Renders the input always; focus or click opens a
 * dropdown below it. Empty query shows recents (last 10 task panels the
 * user opened); typing fires a global ilike search via Supabase.
 *
 * Selecting a result navigates to /projects/:projectId?task=:taskId. We
 * stash a small "recents" list in localStorage from
 * ProjectView/MyTasksPage's selectedTaskId effect — see
 * useRecentTasks#recordTaskOpened.
 */
export function TaskSearchCombobox({
  workspaceId,
}: {
  /** Used only to fetch members for assignee avatars on the result rows.
   *  Searches still hit all projects the user can read. */
  workspaceId: string | undefined;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const recentIds = useRecentTaskIds();
  const { data: recentTasks = [] } = useTasksByIds(open && !query.trim() ? recentIds : []);
  const { data: searchResults = [], isFetching: searching } = useGlobalTaskSearch(
    query,
    open
  );
  const { data: members = [] } = useWorkspaceMembers(workspaceId);

  const showRecents = !query.trim();
  const rows: Row[] = showRecents ? recentTasks : searchResults;

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Reset highlight when the row set changes.
  useEffect(() => {
    setActiveIdx(0);
  }, [rows.length, showRecents]);

  const select = (row: Row) => {
    const projectId = row.project?.id ?? row.project_id;
    if (!projectId) return;
    navigate(`/projects/${projectId}?task=${row.id}`);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rows.length > 0) setActiveIdx((i) => (i + 1) % rows.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rows.length > 0) setActiveIdx((i) => (i - 1 + rows.length) % rows.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = rows[activeIdx];
      if (r) select(r);
    }
  };

  return (
    <div ref={containerRef} className="relative w-72">
      <Search
        className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none"
        aria-hidden
      />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onInputKeyDown}
        placeholder="Search tasks…"
        className="h-8 pl-7 pr-7 text-sm"
        aria-label="Search tasks"
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && (
        <div className="absolute top-full right-0 mt-1 w-[420px] max-h-[70vh] overflow-hidden rounded-md border bg-popover shadow-md z-50 flex flex-col">
          <SectionHeader>
            {showRecents
              ? "Recents"
              : searching
                ? "Searching…"
                : rows.length === 0
                  ? "No tasks match"
                  : `${rows.length} result${rows.length === 1 ? "" : "s"}`}
          </SectionHeader>
          <div className="flex-1 overflow-y-auto p-1">
            {showRecents && recentIds.length === 0 && (
              <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                Open a task and it'll show up here.
              </p>
            )}
            {rows.map((row, idx) => (
              <ResultRow
                key={row.id}
                row={row}
                members={members}
                active={idx === activeIdx}
                onSelect={() => select(row)}
                onHover={() => setActiveIdx(idx)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="shrink-0 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
      {children}
    </div>
  );
}

function ResultRow({
  row,
  members,
  active,
  onSelect,
  onHover,
}: {
  row: Row;
  members: Profile[];
  active: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  const assignee = members.find((m) => m.id === row.assignee_id);
  const done = row.status === "done";

  return (
    <button
      type="button"
      // mousedown fires before the input's blur, so the click registers
      // even if blur would otherwise close the dropdown first.
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect();
      }}
      onMouseEnter={onHover}
      className={cn(
        "w-full flex items-center gap-3 rounded px-2 py-1.5 text-left transition-colors",
        active && "bg-accent"
      )}
    >
      {done ? (
        <Check className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />
      ) : (
        <Circle className="h-4 w-4 text-muted-foreground/60 shrink-0" aria-hidden />
      )}
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            "text-sm truncate",
            done && "line-through text-muted-foreground"
          )}
        >
          {row.title}
        </div>
        {row.project && (
          <div className="text-xs text-muted-foreground inline-flex items-center gap-1 truncate">
            <span
              className={cn("h-2 w-2 rounded-full", projectColorClass(row.project.color))}
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

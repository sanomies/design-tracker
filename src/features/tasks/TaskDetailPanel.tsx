import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format, isBefore, isToday, isTomorrow, parseISO, startOfDay } from "date-fns";
import {
  ArrowUpLeft,
  BadgeCheck,
  Check,
  Newspaper,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  IconCalendar,
  IconCircle,
  IconFlag,
  IconLink,
  IconMaximize,
  IconMinimize,
  IconMoreHorizontal,
  IconSection,
  IconUser,
  IconX,
} from "@/components/icons/figma";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAttachments } from "@/features/attachments/useAttachments";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RichTextEditor, isEmptyHTML } from "@/components/rich-text/RichTextEditor";
import {
  uploadEditorFile,
  uploadEditorImage,
} from "@/components/rich-text/uploadEditorImage";
import { AttachmentList } from "@/features/attachments/AttachmentList";
import { CommentComposer, CommentList } from "@/features/comments/CommentList";
import { useSections } from "@/features/sections/useSections";
import { SubtaskList } from "@/features/tasks/SubtaskList";
import { useWorkspaceMembers } from "@/features/workspaces/useWorkspaceMembers";
import { useIsMobile } from "@/hooks/useIsMobile";
import { avatarColor } from "@/lib/avatarColor";
import { cn } from "@/lib/utils";
import type { Profile, Task, TaskPriority } from "@/types/database";

import { PRIORITIES, priorityMeta } from "./priority";
import { PublicationPickerContent } from "./PublicationPicker";
import { getPublication } from "./publications";
import { TypePickerContent } from "./TypePicker";
import { getTaskType } from "./taskTypes";
import {
  useTasks,
  useUndoableDeleteTask,
  useUndoableRenameTask,
  useUpdateTask,
} from "./useTasks";

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Inline panel — no modal/backdrop. The parent (ProjectView) controls layout
// and decides when to mount this. We render directly so the task list stays
// visible and interactive alongside.
type DetailPanelProps = {
  task: Task;
  workspaceId: string | undefined;
  onClose: () => void;
  /** True when the panel is currently rendered as a fullscreen overlay
   *  by its parent. The header swaps to an inward-pointing arrows icon
   *  when this is on. */
  isFullscreen?: boolean;
  /** Toggle fullscreen ↔ sidebar mode. Owned by the parent because the
   *  layout switch happens above this component. */
  onToggleFullscreen?: () => void;
};

export function TaskDetailPanel({
  task,
  workspaceId,
  onClose,
  isFullscreen,
  onToggleFullscreen,
}: DetailPanelProps) {
  return (
    <PanelBody
      task={task}
      workspaceId={workspaceId}
      onClose={onClose}
      isFullscreen={isFullscreen}
      onToggleFullscreen={onToggleFullscreen}
    />
  );
}

function PanelBody({
  task,
  workspaceId,
  onClose,
  isFullscreen,
  onToggleFullscreen,
}: DetailPanelProps) {
  const isMobile = useIsMobile();
  const updateTask = useUpdateTask(task.project_id);
  // Delete + title rename both go through the undoable helpers so the
  // user gets a 6s "Undo" toast for each (deferred delete; immediate
  // rename with reverse-apply on undo).
  const undoableDeleteTask = useUndoableDeleteTask(task.project_id);
  const undoableRenameTask = useUndoableRenameTask(task.project_id);
  const { data: members } = useWorkspaceMembers(workspaceId);
  const { data: tasks } = useTasks(task.project_id);
  const { data: sections = [] } = useSections(task.project_id);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [, setSearchParams] = useSearchParams();

  // If this task is a subtask, find its parent so we can render a breadcrumb
  // back up the tree.
  const parent = task.parent_task_id
    ? tasks?.find((t) => t.id === task.parent_task_id) ?? null
    : null;

  const openParent = () => {
    if (!task.parent_task_id) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("task", task.parent_task_id!);
        return next;
      },
      { replace: true }
    );
  };

  const update = (patch: Partial<Task>) => {
    updateTask.mutate({ id: task.id, patch });
  };

  const handleDelete = () => {
    // Undoable delete fires its toast immediately and defers the real
    // DB call by 6s; this returns synchronously.
    undoableDeleteTask(task);
    setDeleteOpen(false);
    onClose();
  };

  const copyLink = async () => {
    try {
      // Always copy a link to the task in its project context, regardless
      // of which page the panel was opened from (e.g. /my-tasks). Vite's
      // BASE_URL keeps sub-path deploys working.
      const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
      const url = new URL(window.location.origin + base + `/projects/${task.project_id}`);
      url.searchParams.set("task", task.id);
      await navigator.clipboard.writeText(url.toString());
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  // Subtasks count from the project task tree — used to auto-expand the
  // subtasks section when there's already content to show.
  const subtaskCount = useMemo(
    () => (tasks ?? []).filter((t) => t.parent_task_id === task.id).length,
    [tasks, task.id]
  );
  const { data: attachments } = useAttachments(task.id);
  const attachmentCount = attachments?.length ?? 0;

  const [subtasksOpen, setSubtasksOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const showSubtasks = subtasksOpen || subtaskCount > 0;
  const showAttachments = attachmentsOpen || attachmentCount > 0;

  return (
    <div className="h-full flex flex-col">
      <header className="bg-white border-b border-[#DEDFE0] p-4 flex items-center justify-between gap-4 shrink-0">
        <MarkCompleteButton
          done={task.status === "done"}
          onToggle={() =>
            update({ status: task.status === "done" ? "todo" : "done" })
          }
        />
        {/* All header icons are 18×18 per the latest Figma. Spacing of
            16px between them mirrors the design's `gap-[16px]`. */}
        <div className="flex items-center gap-4 shrink-0">
          <button
            type="button"
            onClick={() => void copyLink()}
            className="h-[18px] w-[18px] inline-flex items-center justify-center text-foreground/80 hover:text-foreground rounded transition-colors"
            aria-label="Copy link to task"
            title="Copy link to task"
          >
            <IconLink className="h-[18px] w-[18px]" />
          </button>
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="h-[18px] w-[18px] inline-flex items-center justify-center text-foreground/80 hover:text-foreground rounded transition-colors"
              aria-label={isFullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
              title={isFullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
            >
              {isFullscreen ? (
                <IconMinimize className="h-[18px] w-[18px]" />
              ) : (
                <IconMaximize className="h-[18px] w-[18px]" />
              )}
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-[18px] w-[18px] text-foreground/80 hover:text-foreground"
                aria-label="Task actions"
              >
                <IconMoreHorizontal className="h-[18px] w-[18px]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => setDeleteOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={onClose}
            className="h-[18px] w-[18px] inline-flex items-center justify-center text-foreground/80 hover:text-foreground rounded transition-colors"
            aria-label="Close"
          >
            <IconX className="h-[18px] w-[18px]" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Inner column spans at least the visible area so the comments
            section's background extends to the bottom of the panel even
            when the content above is short. */}
        <div className="flex flex-col min-h-full">
          <section className="px-4 pt-4 pb-6 space-y-6">
            {task.parent_task_id && (
              <button
                type="button"
                onClick={openParent}
                className="inline-flex items-center gap-1 text-xs text-[#708597] hover:text-foreground max-w-full"
              >
                <ArrowUpLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">
                  {parent ? parent.title : "Back to parent task"}
                </span>
              </button>
            )}

            <TitleField
              task={task}
              onSave={(title) => undoableRenameTask(task, title)}
            />

            {/* Property grid — two columns of stacked rows. Each column
                gets its own internal `divide-y` so the hairline between
                rows lines up per-column even when one column has fewer
                rows than the other. Field order from the Figma:
                  Left  → Brand · Assignee · Due Date
                  Right → Type  · Priority · Section */}
            <div className="grid grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-0">
              <div className="min-w-0 divide-y divide-[#DEDFE0]">
                <PropertyRow
                  label="Brand"
                  compact={isMobile}
                  icon={
                    isMobile ? (
                      <BadgeCheck className="h-[18px] w-[18px] text-foreground" />
                    ) : (
                      <Newspaper className="h-[18px] w-[18px] text-foreground" />
                    )
                  }
                >
                  <PublicationInline
                    value={task.publication}
                    onChange={(publication) => update({ publication })}
                  />
                </PropertyRow>
                <PropertyRow label="Assignee" compact={isMobile} icon={<IconUser className="h-[18px] w-[18px] text-foreground" />}>
                  <AssigneeInline
                    members={members ?? []}
                    value={task.assignee_id}
                    onChange={(assignee_id) => update({ assignee_id })}
                  />
                </PropertyRow>
                <PropertyRow label="Due Date" compact={isMobile} icon={<IconCalendar className="h-[18px] w-[18px] text-foreground" />}>
                  <DueInline
                    value={task.due_date}
                    onChange={(due_date) => update({ due_date })}
                  />
                </PropertyRow>
              </div>
              <div className="min-w-0 divide-y divide-[#DEDFE0]">
                <PropertyRow label="Type" compact={isMobile} icon={<Tag className="h-[18px] w-[18px] text-foreground" />}>
                  <TypeInline
                    value={task.type}
                    onChange={(type) => update({ type })}
                  />
                </PropertyRow>
                <PropertyRow label="Priority" compact={isMobile} icon={<IconFlag className="h-[18px] w-[18px] text-foreground" />}>
                  <PriorityInline
                    value={task.priority}
                    onChange={(priority) => update({ priority })}
                  />
                </PropertyRow>
                {(sections.length > 0 || task.section_id) && (
                  <PropertyRow label="Section" compact={isMobile} icon={<IconSection className="h-[18px] w-[18px] text-foreground" />}>
                    <SectionInline
                      sections={sections}
                      value={task.section_id}
                      onChange={(section_id) => update({ section_id })}
                    />
                  </PropertyRow>
                )}
              </div>
            </div>

            <DescriptionField
              task={task}
              members={members ?? []}
              onSave={(description) => update({ description })}
            />

            {/* Subtasks + Attachment pills. Each collapses behind an outlined
                "+ <name>" pill until the user clicks it (or the task already
                has items in that section, in which case it auto-expands so
                nothing is hidden behind a click). */}
            {(!showSubtasks || !showAttachments) && (
              <div className="flex flex-wrap gap-2">
                {!showSubtasks && (
                  <PillButton
                    icon={<Plus className="h-3.5 w-3.5" />}
                    onClick={() => setSubtasksOpen(true)}
                  >
                    Subtasks
                  </PillButton>
                )}
                {!showAttachments && (
                  <PillButton
                    icon={<Plus className="h-3.5 w-3.5" />}
                    onClick={() => setAttachmentsOpen(true)}
                  >
                    Attachment
                  </PillButton>
                )}
              </div>
            )}
            {showSubtasks && <SubtaskList parentTask={task} />}
            {showAttachments && <AttachmentList task={task} />}
          </section>

          <section className="flex-1 border-t border-[#DEDFE0] bg-[#F6F9F9] px-4 pt-6 pb-4">
            <CommentList taskId={task.id} workspaceId={workspaceId} hideComposer />
          </section>
        </div>
      </div>

      {/* Sticky white composer footer — sits below the scrollable
          content so the "Add a comment" input is always reachable, even
          while scrolling through long meta/description/comment lists. */}
      <footer className="shrink-0 border-t border-[#DEDFE0] bg-white p-4">
        <CommentComposer key={task.id} taskId={task.id} workspaceId={workspaceId} />
      </footer>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              “{task.title}” will be removed permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Table-style property row. Desktop (default) shows a muted icon + text
// label in a fixed 80px left column with the inline editable value on the
// right. Mobile (`compact`) drops the text label entirely — matching the
// Figma task view (node 428:814), which leads each row with just the 18px
// icon, a 16px gap, then the value. The parent applies `divide-y` so a
// stack of these reads as a thin lined table.
function PropertyRow({
  label,
  icon,
  compact = false,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  /** Mobile layout: icon + value only, no text label. */
  compact?: boolean;
  children: React.ReactNode;
}) {
  if (compact) {
    // Icon-only lead, 16px gap to the value. Fixed 44px row height keeps
    // both columns' hairlines aligned across the grid regardless of cell
    // content (24px chip vs. plain text vs. pill).
    return (
      <div className="flex items-center gap-4 h-[44px]">
        <span className="inline-flex shrink-0 items-center text-[#708597]" aria-label={label}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    );
  }

  return (
    // Fixed 44px row height so every row in both columns lines up across
    // the grid, regardless of whether the value cell holds a 24px chip
    // (publication / assignee) or plain text (type / priority / section).
    // Previously `py-2` + `min-h-40` produced 42px rows for chip-bearing
    // values and 40px rows for text values, which drifted across the
    // column.
    <div className="grid grid-cols-[80px_1fr] items-center gap-4 h-[44px]">
      <span className="inline-flex items-center gap-2 text-xs font-medium text-[#708597]">
        {icon}
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// Em-dash placeholder used wherever a property is unset.
function EmptyValue() {
  return <span className="text-xs text-[#708597]">—</span>;
}

const PROPERTY_TRIGGER_CLASS =
  "inline-flex items-center gap-2 rounded px-1 -mx-1 py-0.5 text-xs hover:bg-[#EDF2F4] transition-colors max-w-full min-h-[24px]";

// Outlined "+ Subtasks" / "+ Attachment" reveal pill in the body.
function PillButton({
  icon,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background hover:bg-accent px-3 py-1.5 text-sm font-normal transition-colors"
    >
      {icon}
      {children}
    </button>
  );
}

// Title -----------------------------------------------------------------

function TitleField({ task, onSave }: { task: Task; onSave: (title: string) => void }) {
  // Newly created tasks land here with an empty title — auto-open edit mode
  // so the user can start typing immediately, no extra click required.
  const [editing, setEditing] = useState(task.title === "");
  const [value, setValue] = useState(task.title);

  useEffect(() => {
    if (!editing) setValue(task.title);
  }, [task.title, editing]);

  const commit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setValue(task.title);
      setEditing(false);
      return;
    }
    if (trimmed !== task.title) onSave(trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            setValue(task.title);
            setEditing(false);
          }
        }}
        className="text-lg font-semibold h-auto leading-snug py-1.5 rounded-lg border-[#DEDFE0] shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.1)] focus-visible:ring-offset-0 focus-visible:ring-inset"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-lg font-semibold leading-snug text-left w-full hover:bg-[#EDF2F4] rounded px-1 -mx-1 py-0.5"
    >
      {task.title || <span className="text-[#708597]">Untitled task</span>}
    </button>
  );
}

// Description -----------------------------------------------------------

function DescriptionField({
  task,
  members,
  onSave,
}: {
  task: Task;
  members: Profile[];
  onSave: (value: string | null) => void;
}) {
  // We let RichTextEditor own its internal state via the `key` prop (resets
  // when the task changes) and persist on blur. Comparing HTML strings
  // before mutating keeps idle blurs from firing no-op writes.
  const initial = task.description ?? "";

  const commit = (html: string) => {
    const next = isEmptyHTML(html) ? null : html;
    if (next !== (task.description ?? null)) {
      onSave(next);
    }
  };

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-[#708597]">Description</span>
      <RichTextEditor
        key={task.id}
        value={initial}
        onBlur={commit}
        members={members}
        placeholder="Add a description…"
        minHeight="200px"
        className="rounded-lg border-[#DEDFE0] shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.1)]"
        onUploadImage={(file) => uploadEditorImage(file, task.id)}
        onUploadFile={(file) => uploadEditorFile(file, task.id)}
      />
    </div>
  );
}

// Mark complete pill (top-left of the panel) -------------------------
//
// Same pill chrome in both states — only the leading icon swaps. The
// "Completed" state keeps the muted gray pill (no loud-green flood
// across the chip) and just signals the state via a small green-check
// glyph; matches Figma node 422:10448.

function MarkCompleteButton({
  done,
  onToggle,
}: {
  done: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={done}
      className="inline-flex items-center gap-1 rounded-full border border-[#DEDFE0] bg-[#F6F9F9] hover:bg-[#EDF2F4] pl-2 pr-3 py-2 text-xs font-medium text-foreground transition-colors"
    >
      {done ? (
        <span
          aria-hidden
          className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#00BC7C] text-white"
        >
          <Check className="h-3 w-3" strokeWidth={2.5} />
        </span>
      ) : (
        <IconCircle className="h-[18px] w-[18px] text-[#708597]" aria-hidden />
      )}
      <span>{done ? "Completed" : "Mark as complete"}</span>
    </button>
  );
}

// Publication inline (in the property grid) --------------------------

function PublicationInline({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (slug: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = getPublication(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={PROPERTY_TRIGGER_CLASS}>
          {current ? (
            <>
              <img
                src={current.thumbnail}
                alt=""
                className="h-6 w-6 rounded object-cover shrink-0"
              />
              <span className="truncate">{current.name}</span>
            </>
          ) : (
            <EmptyValue />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-1 w-64 max-h-80 overflow-y-auto">
        <PublicationPickerContent
          value={value}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

// Type inline (in the property grid) ---------------------------------

function TypeInline({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (slug: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = getTaskType(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={PROPERTY_TRIGGER_CLASS}>
          {current ? (
            <span className="truncate">{current.name}</span>
          ) : (
            <EmptyValue />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-1 w-44">
        <TypePickerContent
          value={value}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}


// Assignee inline (avatar + name in the right sidebar) ----------------

function AssigneeInline({
  members,
  value,
  onChange,
}: {
  members: Profile[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = members.find((m) => m.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={PROPERTY_TRIGGER_CLASS}>
          {current ? (
            <>
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarFallback className={cn("text-[10px]", avatarColor(current.id))}>
                  {initials(current.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{current.full_name ?? "Unnamed"}</span>
            </>
          ) : (
            <EmptyValue />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-1 w-56 max-h-80 overflow-y-auto">
        <button
          type="button"
          className={cn(
            "w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent",
            value === null && "bg-accent"
          )}
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
        >
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[10px]">—</AvatarFallback>
          </Avatar>
          Unassigned
        </button>
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            className={cn(
              "w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent",
              value === m.id && "bg-accent"
            )}
            onClick={() => {
              onChange(m.id);
              setOpen(false);
            }}
          >
            <Avatar className="h-5 w-5">
              <AvatarFallback className={cn("text-[10px]", avatarColor(m.id))}>
                {initials(m.full_name)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{m.full_name ?? "Unnamed"}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// Due inline (plain date text in the right sidebar) -------------------

function DueInline({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;
  // Overdue = strictly before start-of-today (so a task due *today* stays
  // neutral; it only turns red once the day has passed).
  const isOverdue =
    !!selected && isBefore(selected, startOfDay(new Date()));
  // Friendly labels for the next two days; everything else falls back to
  // the full "MMM d, yyyy" date format.
  const label = selected
    ? isToday(selected)
      ? "Today"
      : isTomorrow(selected)
        ? "Tomorrow"
        : format(selected, "MMM d, yyyy")
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={PROPERTY_TRIGGER_CLASS}>
          {selected ? (
            <span className={cn(isOverdue && "text-destructive font-medium")}>
              {label}
            </span>
          ) : (
            <EmptyValue />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0 w-auto">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            onChange(date ? format(date, "yyyy-MM-dd") : null);
            setOpen(false);
          }}
          autoFocus
        />
        {selected && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Clear date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Priority inline (badge in the right sidebar) -----------------------

function PriorityInline({
  value,
  onChange,
}: {
  value: TaskPriority | null;
  onChange: (value: TaskPriority | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = priorityMeta(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={PROPERTY_TRIGGER_CLASS}>
          {meta ? (
            <Badge
              variant="outline"
              className={cn("h-5 px-2 rounded-full text-[10px] font-semibold uppercase", meta.className)}
            >
              {meta.label}
            </Badge>
          ) : (
            <EmptyValue />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-1 w-44">
        <button
          type="button"
          className={cn(
            "w-full flex items-center rounded px-2 py-1.5 text-sm hover:bg-accent",
            value === null && "bg-accent"
          )}
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
        >
          No priority
        </button>
        {PRIORITIES.map((p) => (
          <button
            key={p.value}
            type="button"
            className={cn(
              "w-full flex items-center rounded px-2 py-1.5 text-sm hover:bg-accent",
              value === p.value && "bg-accent"
            )}
            onClick={() => {
              onChange(p.value);
              setOpen(false);
            }}
          >
            <Badge
              variant="outline"
              className={cn("h-5 text-[10px] uppercase", p.className)}
            >
              {p.label}
            </Badge>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// Section inline (plain text in the right sidebar) -------------------

function SectionInline({
  sections,
  value,
  onChange,
}: {
  sections: { id: string; name: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = sections.find((s) => s.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={PROPERTY_TRIGGER_CLASS}>
          {current ? (
            <span className="truncate">{current.name}</span>
          ) : (
            <EmptyValue />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-1 w-56 max-h-80 overflow-y-auto">
        <button
          type="button"
          className={cn(
            "w-full flex items-center rounded px-2 py-1.5 text-sm hover:bg-accent",
            value === null && "bg-accent"
          )}
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
        >
          No section
        </button>
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            className={cn(
              "w-full flex items-center rounded px-2 py-1.5 text-sm hover:bg-accent",
              value === s.id && "bg-accent"
            )}
            onClick={() => {
              onChange(s.id);
              setOpen(false);
            }}
          >
            <span className="truncate">{s.name}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

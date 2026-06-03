import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import {
  ArrowUpLeft,
  MoreHorizontal,
  Newspaper,
  Plus,
  Trash2,
  X,
} from "lucide-react";

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
import { CommentList } from "@/features/comments/CommentList";
import { useSections } from "@/features/sections/useSections";
import { SubtaskList } from "@/features/tasks/SubtaskList";
import { useWorkspaceMembers } from "@/features/workspaces/useWorkspaceMembers";
import { avatarColor } from "@/lib/avatarColor";
import { cn } from "@/lib/utils";
import type { Profile, Task, TaskPriority } from "@/types/database";

import { PRIORITIES, priorityMeta } from "./priority";
import { PublicationPickerContent } from "./PublicationPicker";
import { getPublication } from "./publications";
import { useDeleteTask, useTasks, useUpdateTask } from "./useTasks";

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
export function TaskDetailPanel({
  task,
  workspaceId,
  onClose,
}: {
  task: Task;
  workspaceId: string | undefined;
  onClose: () => void;
}) {
  return <PanelBody task={task} workspaceId={workspaceId} onClose={onClose} />;
}

function PanelBody({
  task,
  workspaceId,
  onClose,
}: {
  task: Task;
  workspaceId: string | undefined;
  onClose: () => void;
}) {
  const updateTask = useUpdateTask(task.project_id);
  const deleteTask = useDeleteTask(task.project_id);
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

  const handleDelete = async () => {
    try {
      await deleteTask.mutateAsync(task.id);
      setDeleteOpen(false);
      onClose();
    } catch {
      // Toast already fired.
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
      <header className="px-4 py-3 flex items-center justify-between gap-3 shrink-0">
        <PublicationPill
          value={task.publication}
          onChange={(publication) => update({ publication })}
        />
        <div className="flex items-center gap-1 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Task actions">
                <MoreHorizontal className="h-4 w-4" />
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
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Inner column spans at least the visible area so the comments
            section's background extends to the bottom of the panel even
            when the content above is short. */}
        <div className="flex flex-col min-h-full">
          <section className="px-4 pb-4 space-y-4">
            {task.parent_task_id && (
              <button
                type="button"
                onClick={openParent}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground max-w-full"
              >
                <ArrowUpLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">
                  {parent ? parent.title : "Back to parent task"}
                </span>
              </button>
            )}

            <TitleField task={task} onSave={(title) => update({ title })} />

            <div className="divide-y">
              <PropertyRow label="Assignee">
                <AssigneeInline
                  members={members ?? []}
                  value={task.assignee_id}
                  onChange={(assignee_id) => update({ assignee_id })}
                />
              </PropertyRow>
              <PropertyRow label="Due">
                <DueInline
                  value={task.due_date}
                  onChange={(due_date) => update({ due_date })}
                />
              </PropertyRow>
              <PropertyRow label="Priority">
                <PriorityInline
                  value={task.priority}
                  onChange={(priority) => update({ priority })}
                />
              </PropertyRow>
              {(sections.length > 0 || task.section_id) && (
                <PropertyRow label="Section">
                  <SectionInline
                    sections={sections}
                    value={task.section_id}
                    onChange={(section_id) => update({ section_id })}
                  />
                </PropertyRow>
              )}
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

          <section className="flex-1 border-t bg-[#F5F7FA] p-4">
            <CommentList taskId={task.id} workspaceId={workspaceId} />
          </section>
        </div>
      </div>

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

// Table-style property row: muted label on the left, inline editable value
// on the right. The parent applies `border-y divide-y` so a stack of these
// reads as a thin lined table.
function PropertyRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// Em-dash placeholder used wherever a property is unset.
function EmptyValue() {
  return <span className="text-sm text-muted-foreground">—</span>;
}

const PROPERTY_TRIGGER_CLASS =
  "inline-flex items-center gap-1.5 rounded px-1 -mx-1 py-0.5 text-sm hover:bg-accent transition-colors max-w-full min-h-[28px]";

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
  const [editing, setEditing] = useState(false);
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
        className="text-2xl md:text-2xl font-bold h-auto leading-tight py-2 focus-visible:ring-offset-0 focus-visible:ring-inset"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-2xl font-bold leading-tight text-left w-full hover:bg-muted/50 rounded px-1 -mx-1 py-0.5"
    >
      {task.title}
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
    <div className="space-y-1.5">
      <span className="text-sm text-muted-foreground">Description</span>
      <div className="rounded-md border border-input">
        <RichTextEditor
          key={task.id}
          value={initial}
          onBlur={commit}
          members={members}
          placeholder="Add a description…"
          minHeight="120px"
          onUploadImage={(file) => uploadEditorImage(file, task.id)}
          onUploadFile={(file) => uploadEditorFile(file, task.id)}
        />
      </div>
    </div>
  );
}

// Publication pill (top-left of the panel) ----------------------------

function PublicationPill({
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
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md bg-muted/60 hover:bg-muted px-3 py-1.5 text-sm font-medium transition-colors max-w-full min-h-[36px]"
        >
          {current ? (
            <img
              src={current.thumbnail}
              alt=""
              className="h-6 w-6 rounded object-cover shrink-0"
            />
          ) : (
            <span className="h-6 w-6 inline-flex items-center justify-center shrink-0">
              <Newspaper className="h-4 w-4 text-muted-foreground" aria-hidden />
            </span>
          )}
          <span className="truncate">{current ? current.name : "No publication"}</span>
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
              <Avatar className="h-5 w-5 shrink-0">
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={PROPERTY_TRIGGER_CLASS}>
          {selected ? (
            <span>{format(selected, "MMM d, yyyy")}</span>
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
          initialFocus
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
              className={cn("h-5 text-[10px] uppercase", meta.className)}
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

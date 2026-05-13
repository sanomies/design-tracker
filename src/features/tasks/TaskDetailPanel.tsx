import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon, MoreHorizontal, Trash2, X } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor, isEmptyHTML } from "@/components/rich-text/RichTextEditor";
import { AttachmentList } from "@/features/attachments/AttachmentList";
import { CommentList } from "@/features/comments/CommentList";
import { useWorkspaceMembers } from "@/features/workspaces/useWorkspaceMembers";
import { cn } from "@/lib/utils";
import type { Profile, Task, TaskPriority, TaskStatus } from "@/types/database";

import { PRIORITIES } from "./priority";
import { useDeleteTask, useUpdateTask } from "./useTasks";

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

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
  const [deleteOpen, setDeleteOpen] = useState(false);

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

  return (
    <div className="h-full flex flex-col">
      <header className="px-4 py-3 border-b flex items-center justify-between shrink-0">
        <h2 className="text-sm font-medium text-muted-foreground">Task details</h2>
        <div className="flex items-center gap-1">
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
          <section className="p-4 space-y-6">
            <TitleField task={task} onSave={(title) => update({ title })} />

            <div className="space-y-3">
              <FieldRow label="Assignee">
                <AssigneePicker
                  members={members ?? []}
                  value={task.assignee_id}
                  onChange={(assignee_id) => update({ assignee_id })}
                />
              </FieldRow>
              <FieldRow label="Due date">
                <DueDatePicker
                  value={task.due_date}
                  onChange={(due_date) => update({ due_date })}
                />
              </FieldRow>
              <FieldRow label="Priority">
                <PrioritySelect
                  value={task.priority}
                  onChange={(priority) => update({ priority })}
                />
              </FieldRow>
              <FieldRow label="Status">
                <StatusSelect
                  value={task.status}
                  onChange={(status) => update({ status })}
                />
              </FieldRow>
            </div>

            <DescriptionField
              task={task}
              members={members ?? []}
              onSave={(description) => update({ description })}
            />

            <AttachmentList taskId={task.id} />
          </section>

          <section className="flex-1 border-t bg-muted/30 p-4">
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

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[80px_1fr] items-center gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div>{children}</div>
    </div>
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
        className="text-lg font-semibold"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-lg font-semibold leading-snug text-left w-full hover:bg-muted/50 rounded px-1 -mx-1 py-0.5"
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
      <span className="text-xs text-muted-foreground">Description</span>
      <RichTextEditor
        key={task.id}
        value={initial}
        onBlur={commit}
        members={members}
        placeholder="Add more detail… @ to mention"
        minHeight="120px"
      />
    </div>
  );
}

// Assignee --------------------------------------------------------------

function AssigneePicker({
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
        <Button variant="outline" size="sm" className="w-full justify-start font-normal">
          <Avatar className="h-5 w-5 mr-2">
            <AvatarFallback className="text-[10px]">
              {current ? initials(current.full_name) : "—"}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">
            {current ? current.full_name ?? "Unnamed" : "Unassigned"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-1 w-56">
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
              <AvatarFallback className="text-[10px]">{initials(m.full_name)}</AvatarFallback>
            </Avatar>
            <span className="truncate">{m.full_name ?? "Unnamed"}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// Due date --------------------------------------------------------------

function DueDatePicker({
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
        <Button variant="outline" size="sm" className="w-full justify-start font-normal">
          <CalendarIcon className="h-4 w-4 mr-2" />
          {selected ? format(selected, "MMM d, yyyy") : <span className="text-muted-foreground">No due date</span>}
        </Button>
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

// Priority --------------------------------------------------------------

function PrioritySelect({
  value,
  onChange,
}: {
  value: TaskPriority | null;
  onChange: (value: TaskPriority | null) => void;
}) {
  return (
    <Select
      value={value ?? "__none__"}
      onValueChange={(v) => onChange(v === "__none__" ? null : (v as TaskPriority))}
    >
      <SelectTrigger className="h-9 text-sm font-normal">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">No priority</SelectItem>
        {PRIORITIES.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Status ----------------------------------------------------------------

function StatusSelect({
  value,
  onChange,
}: {
  value: TaskStatus;
  onChange: (value: TaskStatus) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TaskStatus)}>
      <SelectTrigger className="h-9 text-sm font-normal">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

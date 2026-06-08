import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/database";

import { TaskCheckbox } from "./TaskCheckbox";
import {
  useCreateTask,
  useTasks,
  useUndoableDeleteTask,
  useUpdateTask,
} from "./useTasks";

export function SubtaskList({ parentTask }: { parentTask: Task }) {
  const { data: tasks } = useTasks(parentTask.project_id);
  const createTask = useCreateTask(parentTask.project_id);

  const subtasks = useMemo(
    () => (tasks ?? []).filter((t) => t.parent_task_id === parentTask.id),
    [tasks, parentTask.id]
  );

  const doneCount = subtasks.filter((s) => s.status === "done").length;

  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    createTask.mutate({ title, parentTaskId: parentTask.id });
    setDraft("");
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-2">
      <header className="flex items-center gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Subtasks
        </h3>
        {subtasks.length > 0 && (
          <span className="inline-flex items-center justify-center min-w-[36px] h-5 rounded-full bg-muted text-[11px] px-2">
            {doneCount}/{subtasks.length}
          </span>
        )}
      </header>

      {subtasks.length > 0 && (
        <ul className="space-y-0.5">
          {subtasks.map((subtask) => (
            <SubtaskRow key={subtask.id} subtask={subtask} />
          ))}
        </ul>
      )}

      <form onSubmit={submit}>
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a subtask — press Enter"
          className="h-8 text-sm"
          autoComplete="off"
        />
      </form>
    </div>
  );
}

function SubtaskRow({ subtask }: { subtask: Task }) {
  const updateTask = useUpdateTask(subtask.project_id);
  const undoableDeleteTask = useUndoableDeleteTask(subtask.project_id);
  const [, setSearchParams] = useSearchParams();

  const done = subtask.status === "done";

  const openInPanel = () => {
    // Updating the URL search param swaps the task the detail panel is
    // viewing. ProjectView reads `?task=<id>` and re-keys the panel.
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("task", subtask.id);
        return next;
      },
      { replace: true }
    );
  };

  const toggleDone = () => {
    updateTask.mutate({ id: subtask.id, patch: { status: done ? "todo" : "done" } });
  };

  return (
    <li
      className="group flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/50 cursor-pointer"
      onClick={openInPanel}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openInPanel();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <TaskCheckbox
        checked={done}
        onCheckedChange={toggleDone}
        onClick={(e) => e.stopPropagation()}
        aria-label={done ? "Mark incomplete" : "Mark complete"}
        className="h-[18px] w-[18px]"
      />
      <span
        className={cn(
          "flex-1 text-sm truncate",
          done && "line-through text-muted-foreground"
        )}
      >
        {subtask.title}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          undoableDeleteTask(subtask);
        }}
        aria-label={`Delete ${subtask.title}`}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

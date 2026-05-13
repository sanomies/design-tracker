import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import { TaskRow } from "./TaskRow";
import { useCreateTask, useTasks } from "./useTasks";

export function TaskList({
  projectId,
  workspaceId,
}: {
  projectId: string;
  workspaceId: string | undefined;
}) {
  const { data: tasks, isLoading } = useTasks(projectId);
  const createTask = useCreateTask(projectId);

  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTaskId = searchParams.get("task");

  const setSelectedTaskId = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("task", id);
    else next.delete("task");
    setSearchParams(next, { replace: true });
  };

  // Global `/` shortcut focuses the inline-add input.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      // Don't hijack `/` if the user is typing in a field.
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const submitNewTask = (e: React.FormEvent) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    createTask.mutate({ title });
    setDraft("");
    // Keep focus so the user can keep adding tasks.
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col">
      <form onSubmit={submitNewTask} className="px-3 py-3 border-b bg-background sticky top-0 z-10">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a task — press Enter   ( / to focus )"
          className="h-9"
          autoComplete="off"
        />
      </form>

      {isLoading ? (
        <div className="px-3 py-2 space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-3/4" />
        </div>
      ) : tasks && tasks.length > 0 ? (
        <ul className="divide-y-0">
          {tasks.map((task) => (
            <li key={task.id}>
              <TaskRow
                task={task}
                workspaceId={workspaceId}
                selected={task.id === selectedTaskId}
                onSelect={() => setSelectedTaskId(task.id)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-6 py-16 text-center text-sm text-muted-foreground">
          No tasks yet. Use the input above to add your first one.
        </div>
      )}
    </div>
  );
}

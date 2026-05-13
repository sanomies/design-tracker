import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { DEFAULT_PROJECT_COLOR, PROJECT_COLORS, type ProjectColor } from "./colors";
import { useCreateProject } from "./useProjects";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Keep it under 80 characters"),
  color: z.enum(["pink", "red", "orange", "yellow", "green", "teal"]),
});
type Values = z.infer<typeof schema>;

export function NewProjectDialog({
  open,
  onOpenChange,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
}) {
  const navigate = useNavigate();
  const createProject = useCreateProject(workspaceId);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", color: DEFAULT_PROJECT_COLOR },
  });

  // Reset the form whenever the dialog opens so prior state doesn't bleed in.
  useEffect(() => {
    if (open) {
      form.reset({ name: "", color: DEFAULT_PROJECT_COLOR });
    }
  }, [open, form]);

  const onSubmit = async (values: Values) => {
    try {
      const project = await createProject.mutateAsync(values);
      onOpenChange(false);
      // Avoid navigating to the optimistic temp ID — only redirect on the
      // real server-returned row.
      if (!project.id.startsWith("temp-")) {
        navigate(`/projects/${project.id}`);
      }
    } catch {
      // Toast already fired in the mutation's onError.
    }
  };

  const selectedColor = form.watch("color");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Give it a name and pick a color.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              autoFocus
              placeholder="e.g. Website Redesign"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-2">
              {PROJECT_COLORS.map((c) => {
                const active = selectedColor === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    aria-label={c.label}
                    aria-pressed={active}
                    onClick={() => form.setValue("color", c.value as ProjectColor)}
                    className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center transition",
                      c.className,
                      active ? "ring-2 ring-offset-2 ring-foreground" : "hover:scale-110"
                    )}
                  >
                    {active && <Check className="h-3.5 w-3.5 text-white" aria-hidden />}
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
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
import type { Project } from "@/types/database";

import {
  DEFAULT_PROJECT_COLOR_HEX,
  PROJECT_COLORS,
} from "./colors";
import { ProjectKindField } from "./ProjectKindField";
import { useCreateProject } from "./useProjects";

const NAME_MAX = 80;

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

  // Local form state — kept here instead of react-hook-form because the
  // colour picker isn't a native input and the form is two fields.
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_PROJECT_COLOR_HEX);
  const [kind, setKind] = useState<Project["kind"]>("marketing");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset the form whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setName("");
      setColor(DEFAULT_PROJECT_COLOR_HEX);
      setKind("marketing");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    if (trimmed.length > NAME_MAX) {
      setError(`Keep it under ${NAME_MAX} characters`);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const project = await createProject.mutateAsync({ name: trimmed, color, kind });
      onOpenChange(false);
      if (!project.id.startsWith("temp-")) {
        navigate(`/projects/${project.id}`);
      }
    } catch {
      // Toast already fired in the mutation's onError.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Give it a name and pick a color.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-project-name">Name</Label>
            <Input
              id="new-project-name"
              autoFocus
              placeholder="e.g. Website Redesign"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={NAME_MAX + 1}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <ColorPicker
              value={color}
              onChange={setColor}
              presets={PROJECT_COLORS.map((c) => ({ value: c.hex, label: c.label }))}
            />
          </div>

          <ProjectKindField value={kind} onChange={setKind} />

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

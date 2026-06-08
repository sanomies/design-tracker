import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Project } from "@/types/database";

import { PROJECT_COLORS, resolveProjectColor } from "./colors";
import { useUpdateProject } from "./useProjects";

const NAME_MAX = 80;

/**
 * Two-field edit dialog (name + color) opened from the project row's
 * three-dot menu. Mirrors the New Project dialog's layout so the two
 * surfaces feel like the same thing in two modes. Submits a single
 * patch — useUpdateProject merges whichever fields changed.
 */
export function EditProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateProject(project.workspace_id);

  const [name, setName] = useState(project.name);
  const [color, setColor] = useState<string>(resolveProjectColor(project.color));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Re-seed the form each time the dialog opens, so prior drafts don't
  // persist across openings and so an external change to the project
  // (e.g. via realtime) is reflected.
  useEffect(() => {
    if (open) {
      setName(project.name);
      setColor(resolveProjectColor(project.color));
      setError(null);
      setSubmitting(false);
    }
  }, [open, project.name, project.color]);

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

    // Build a minimal patch — skip fields that didn't change so the
    // optimistic update doesn't pretend to do work it doesn't need to.
    const patch: { name?: string; color?: string } = {};
    if (trimmed !== project.name) patch.name = trimmed;
    if (color.toUpperCase() !== resolveProjectColor(project.color).toUpperCase()) {
      patch.color = color;
    }
    if (Object.keys(patch).length === 0) {
      onOpenChange(false);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await update.mutateAsync({ id: project.id, patch });
      onOpenChange(false);
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
          <DialogTitle>Edit project</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-project-name">Name</Label>
            <Input
              id="edit-project-name"
              autoFocus
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

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

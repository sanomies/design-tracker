import { useState } from "react";
import { useMatch, useNavigate, useParams } from "react-router-dom";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  defaultAnimateLayoutChanges,
  useSortable,
  type AnimateLayoutChanges,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Skip the "settle" animation that dnd-kit normally plays on every
// non-dragged item when a drop lands — it briefly re-animates the row
// above the dropped one into its new layout slot, which the user sees
// as a jump because my onMutate already re-sorted the cached array
// into the final order. We still want the smooth swap animation while
// the user is actively dragging, so only `wasDragging` returns false;
// everything else falls through to the dnd-kit default.
const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  args.wasDragging ? false : defaultAnimateLayoutChanges(args);

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/database";

import { projectInitial, resolveProjectColor } from "./colors";
import { useDeleteProject } from "./useProjects";
import { EditProjectDialog } from "./EditProjectDialog";

/**
 * Solid-colored 24×24 pill that sits in front of a project name in the
 * sidebar and project headers. Matches the Figma's
 * `h-[24px] min-w-[24px] rounded-[16px] text-[14px] font-bold text-white`
 * spec — used at one size everywhere it appears in the redesign.
 */
export function ProjectLetterPill({
  color,
  name,
}: {
  color: string | null;
  name: string;
}) {
  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-2xl shrink-0 text-sm font-bold text-white"
      style={{ backgroundColor: resolveProjectColor(color) }}
      aria-hidden
    >
      {projectInitial(name)}
    </span>
  );
}

export function ProjectRow({ project }: { project: Project }) {
  const navigate = useNavigate();
  // Replaces NavLink's render-prop isActive — we can't use NavLink
  // here because the browser-native click on <a> kept racing with
  // dnd-kit's drag end (the row would fire navigation on drop, which
  // re-rendered the sidebar and made it look like the drag had
  // "flashed back"). A plain div with onClick + useMatch gives the
  // same active-row styling without the anchor side-effects, and the
  // browser already suppresses click events that follow a >5px move,
  // so click-vs-drag disambiguation is automatic.
  const match = useMatch(`/projects/${project.id}`);
  const isActive = !!match;
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Whole-row drag activator with an 8px activation distance, so a
  // quick click still navigates and only a deliberate drag starts a
  // reorder. Temp-id projects (mid-create) skip dnd entirely — they
  // have no real DB row yet to update.
  const isPending = project.id.startsWith("temp-");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: project.id,
    disabled: isPending,
    animateLayoutChanges,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // Pin the row to its own GPU compositor layer for the duration
        // of a sort. Without this, the browser re-rasterises the row's
        // text every frame at the new sub-pixel offset of the dnd-kit
        // transform — visible to the user as flicker on the labels.
        // We only hint `will-change` while actually sorting so idle
        // rows don't pay the memory cost of an extra layer each.
        willChange: isDragging || transform ? "transform" : undefined,
        backfaceVisibility: "hidden",
      }}
      className={cn("group relative", isDragging && "opacity-60 z-10")}
      {...attributes}
      {...listeners}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/projects/${project.id}`)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            navigate(`/projects/${project.id}`);
          }
        }}
        className={cn(
          "flex items-center gap-2 rounded-lg p-2 text-sm transition-colors",
          // Active project gets a heavier weight per the latest sidebar
          // Figma — semibold against the #EDF2F4 highlight; inactive
          // rows stay medium so the active row visually pops.
          isActive
            ? "bg-[#EDF2F4] text-foreground font-semibold"
            : "hover:bg-[#EDF2F4]/60 text-foreground font-medium",
          // Pointer for the rest state (this is a link); only switch
          // to the grabbing-hand cursor once dnd-kit is actively
          // dragging the row, since at rest there's no visible
          // signal to the user that the row is draggable.
          isDragging ? "cursor-grabbing" : "cursor-pointer"
        )}
      >
        <ProjectLetterPill color={project.color} name={project.name} />
        <span className="truncate flex-1">{project.name}</span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            // Stop drag listeners on the dropdown button — pointer events
            // bubble up to the row otherwise and starting an 8px drag
            // from the button steals the click.
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 focus:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
            aria-label={`Actions for ${project.name}`}
            onClick={(e) => e.preventDefault()}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setDeleteOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditProjectDialog
        project={project}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <DeleteProjectDialog
        project={project}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}

// Delete ----------------------------------------------------------------

function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const params = useParams<{ projectId: string }>();
  const isCurrent = params.projectId === project.id;
  const deleteProject = useDeleteProject(project.workspace_id);

  const onConfirm = async () => {
    try {
      await deleteProject.mutateAsync(project.id);
      onOpenChange(false);
      if (isCurrent) {
        navigate("/", { replace: true });
      }
    } catch {
      // Toast already fired.
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{project.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This will also delete every task in this project. This action can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

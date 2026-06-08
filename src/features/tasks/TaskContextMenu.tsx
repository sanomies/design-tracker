import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  Link2,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { Task } from "@/types/database";

type Position = { x: number; y: number };

type Props = {
  task: Task;
  position: Position;
  onClose: () => void;
  onDuplicate: () => void;
  onToggleStatus: () => void;
  onOpen: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
};

/**
 * Right-click context menu for a task row. Rendered into a body-level
 * portal so it can sit on top of every other layer (sticky headers,
 * detail panel, popovers). Click-outside and `Escape` both close it.
 *
 * Positioning: the menu opens at the click coordinates but mirrors back
 * onto itself if it would overflow the viewport on either axis, so the
 * full menu is always visible regardless of where on screen the user
 * right-clicked.
 */
export function TaskContextMenu({
  task,
  position,
  onClose,
  onDuplicate,
  onToggleStatus,
  onOpen,
  onCopyLink,
  onDelete,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const done = task.status === "done";

  // Adjusted coords default to the raw click position; the layout effect
  // below reflects the menu back onto the visible viewport once it's
  // mounted and we can read its actual dimensions.
  const [coords, setCoords] = useState<Position>(position);

  useLayoutEffect(() => {
    const node = menuRef.current;
    if (!node) return;
    const { offsetWidth, offsetHeight } = node;
    // 8px gutter so the menu never hugs the viewport edge.
    const margin = 8;
    const maxX = window.innerWidth - offsetWidth - margin;
    const maxY = window.innerHeight - offsetHeight - margin;
    setCoords({
      x: Math.max(margin, Math.min(position.x, maxX)),
      y: Math.max(margin, Math.min(position.y, maxY)),
    });
  }, [position]);

  // Close on outside-click or Escape. `mousedown` (not `click`) so the menu
  // closes even if the outside target is a button that swallows the
  // subsequent `click` event.
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // A right-click anywhere else should also close this menu — the
    // parent re-opens a fresh one at the new coords if it lands on
    // another task row.
    const handleContextMenu = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKey);
    document.addEventListener("contextmenu", handleContextMenu);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Actions for ${task.title || "task"}`}
      style={{ left: coords.x, top: coords.y }}
      className="fixed z-50 min-w-[200px] rounded-lg border border-[#DEDFE0] bg-white p-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
    >
      <MenuItem
        icon={<Copy className="h-3.5 w-3.5 text-[#708597]" />}
        onClick={() => {
          onDuplicate();
          onClose();
        }}
      >
        Duplicate task
      </MenuItem>
      <MenuItem
        icon={
          done ? (
            <Circle className="h-3.5 w-3.5 text-[#708597]" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-[#708597]" />
          )
        }
        onClick={() => {
          onToggleStatus();
          onClose();
        }}
      >
        {done ? "Mark incomplete" : "Mark complete"}
      </MenuItem>
      <MenuItem
        icon={<ExternalLink className="h-3.5 w-3.5 text-[#708597]" />}
        onClick={() => {
          onOpen();
          onClose();
        }}
      >
        Open task details
      </MenuItem>
      <MenuItem
        icon={<Link2 className="h-3.5 w-3.5 text-[#708597]" />}
        onClick={() => {
          onCopyLink();
          onClose();
        }}
      >
        Copy task link
      </MenuItem>
      <div className="my-1 h-px bg-[#DEDFE0]" />
      <MenuItem
        icon={<Trash2 className="h-3.5 w-3.5 text-destructive" />}
        destructive
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        Delete task
      </MenuItem>
    </div>,
    document.body
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  destructive = false,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm text-left transition-colors",
        destructive
          ? "text-destructive hover:bg-destructive/10 focus:bg-destructive/10"
          : "text-foreground hover:bg-[#EDF2F4] focus:bg-[#EDF2F4]"
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
  );
}

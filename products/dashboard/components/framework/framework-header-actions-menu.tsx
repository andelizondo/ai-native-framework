"use client";

import { useEffect, useRef, useState } from "react";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";

interface FrameworkHeaderActionsMenuProps {
  entityName: string;
  onRename: () => void;
  onDelete: () => void;
}

export function FrameworkHeaderActionsMenu({
  entityName,
  onRename,
  onDelete,
}: FrameworkHeaderActionsMenuProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={`Open ${entityName} actions`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-md border border-border bg-bg-2 text-t2 transition hover:border-border-hi hover:bg-bg-3 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-expanded:border-accent aria-expanded:bg-primary-bg aria-expanded:text-accent"
      >
        <Ellipsis className="h-[15px] w-[15px]" strokeWidth={2.4} />
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-30 min-w-[168px] rounded-xl border border-border-hi bg-bg-2 p-1.5 shadow-[var(--shadow-canvas)]">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onRename();
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] text-t1 transition hover:bg-bg-3"
          >
            <Pencil className="h-3.5 w-3.5" />
            Rename
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] text-[#f87171] transition hover:bg-linear-to-b hover:from-[#ef4444] hover:to-[#dc2626] hover:text-[#fff7f7]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

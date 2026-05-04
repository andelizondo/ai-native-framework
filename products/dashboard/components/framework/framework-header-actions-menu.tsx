"use client";

import { Pencil, Trash2 } from "lucide-react";

import { IconButtonTooltip } from "@/components/ui/icon-button-tooltip";

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
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border bg-bg-2 p-0.5">
      <IconButtonTooltip
        type="button"
        tooltip={`Rename ${entityName}`}
        onClick={onRename}
        align="end"
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
      </IconButtonTooltip>
      <span aria-hidden className="h-4 w-px bg-border" />
      <IconButtonTooltip
        type="button"
        tooltip={`Delete ${entityName}`}
        onClick={onDelete}
        align="end"
        className="text-[#f87171] hover:bg-linear-to-b hover:from-[#ef4444] hover:to-[#dc2626] hover:text-[#fff7f7]"
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
      </IconButtonTooltip>
    </div>
  );
}

"use client";

import { Trash2 } from "lucide-react";

import { IconButtonTooltip } from "@/components/ui/icon-button-tooltip";

interface FrameworkHeaderActionsMenuProps {
  entityName: string;
  onDelete: () => void;
}

export function FrameworkHeaderActionsMenu({
  entityName,
  onDelete,
}: FrameworkHeaderActionsMenuProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border bg-bg-2 p-0.5">
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

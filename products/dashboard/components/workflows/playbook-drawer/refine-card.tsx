"use client";

import { Sparkles } from "lucide-react";

export interface RefineCardProps {
  onRefine: () => void;
  disabled?: boolean;
}

export function RefineCard({ onRefine, disabled = false }: RefineCardProps) {
  return (
    <div className="pb-drawer-refine" data-testid="pb-drawer-refine">
      <Sparkles size={13} aria-hidden />
      <span>Run a quick retro to update the playbook with what you learned.</span>
      <button
        type="button"
        className="pb-drawer-refine__btn"
        onClick={onRefine}
        disabled={disabled}
        data-testid="pb-drawer-refine-btn"
      >
        Refine playbook
      </button>
    </div>
  );
}

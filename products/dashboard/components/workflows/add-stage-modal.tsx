"use client";

import { useState } from "react";

import type { WorkflowStage } from "@/lib/workflows/types";

interface AddStageModalProps {
  mode?: "create" | "edit";
  initialStage?: Pick<WorkflowStage, "label" | "sub">;
  onClose: () => void;
  onSubmit: (stage: Pick<WorkflowStage, "label" | "sub">) => void;
}

export function AddStageModal({
  mode = "create",
  initialStage,
  onClose,
  onSubmit,
}: AddStageModalProps) {
  const nameId = "stage-name";
  const subId = "stage-sub";
  const [label, setLabel] = useState(initialStage?.label ?? "");
  const [sub, setSub] = useState(initialStage?.sub ?? "");

  const canSubmit = label.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-(--overlay) p-4 backdrop-blur-[3px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          onSubmit({ label: label.trim(), sub: sub.trim() });
          onClose();
        }}
        className="w-full max-w-[420px] rounded-[14px] border border-border-hi bg-bg-2 p-7 shadow-[var(--shadow-canvas)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-stage-modal-title"
      >
        <div id="add-stage-modal-title" className="text-[16px] font-bold tracking-tight text-t1">
          {mode === "edit" ? "Edit stage" : "Add stage"}
        </div>
        <div className="mb-4 mt-1 text-[12.5px] text-t3">
          Define the stage label and optional subtitle.
        </div>

        <label htmlFor={nameId} className="mb-1.5 block text-[11px] font-medium text-t2">
          Stage name
        </label>
        <input
          id={nameId}
          autoFocus
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Stage name"
          className="mb-3 block w-full rounded-lg border border-border bg-bg-3 px-3 py-2.5 text-[13px] text-t1 placeholder:text-t3 focus:border-primary focus:outline-none"
        />

        <label htmlFor={subId} className="mb-1.5 block text-[11px] font-medium text-t2">
          Subtitle (optional)
        </label>
        <input
          id={subId}
          value={sub}
          onChange={(event) => setSub(event.target.value)}
          placeholder="Short description"
          className="mb-5 block w-full rounded-lg border border-border bg-bg-3 px-3 py-2.5 text-[13px] text-t1 placeholder:text-t3 focus:border-primary focus:outline-none"
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-bg-3 px-4 py-2 text-[13px] font-medium text-t2 transition hover:bg-bg-4 hover:text-t1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-primary px-5 py-2 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mode === "edit" ? "Save stage →" : "Add stage →"}
          </button>
        </div>
      </form>
    </div>
  );
}

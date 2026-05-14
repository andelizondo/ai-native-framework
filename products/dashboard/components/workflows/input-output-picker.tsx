"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TemplateOutputGroup } from "@/lib/workflows/types";

interface InputOutputPickerProps {
  /** Currently wired playbook output id, or null when unwired. */
  upstreamOutputId: string | null;
  /** Outputs grouped per playbook attached to the template. */
  available: TemplateOutputGroup[];
  /** True when the input has an upstreamTaskRef set but no output id. */
  hasUpstreamTaskWithoutOutput?: boolean;
  /**
   * Called when the user picks or clears an output. The `playbookId` is
   * supplied so callers can stamp `upstreamTaskRef` alongside
   * `upstreamOutputId` without having to re-resolve it themselves.
   */
  onChange: (next: { outputId: string; playbookId: string } | null) => void;
}

/**
 * Two-step "From playbook ▾ → Output ▾" picker for `WorkflowInput.upstreamOutputId`.
 * Mirrors the existing dashboard select styling — no new design primitives.
 */
export function InputOutputPicker({
  upstreamOutputId,
  available,
  hasUpstreamTaskWithoutOutput,
  onChange,
}: InputOutputPickerProps) {
  const wiredGroup = upstreamOutputId
    ? available.find((group) =>
        group.outputs.some((output) => output.id === upstreamOutputId),
      )
    : null;
  const wiredOutput = wiredGroup?.outputs.find((o) => o.id === upstreamOutputId) ?? null;

  const [pendingPlaybookId, setPendingPlaybookId] = useState<string>(
    wiredGroup?.playbookId ?? "",
  );
  const activePlaybookId = wiredGroup?.playbookId ?? pendingPlaybookId;
  const activeGroup = available.find((g) => g.playbookId === activePlaybookId) ?? null;

  if (wiredOutput && wiredGroup) {
    return (
      <div className="flex items-center gap-1.5">
        <span
          className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-3 px-2 py-1 text-[11px] text-t2"
          data-testid="input-wiring-chip"
        >
          <span className="text-t3">Output:</span>
          <span className="font-medium text-t1">{wiredGroup.playbookName}</span>
          <span className="text-t3">/</span>
          <span>{wiredOutput.name}</span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setPendingPlaybookId("");
            }}
            aria-label="Clear wiring"
            className="ml-0.5 rounded p-0.5 text-t3 transition hover:bg-bg-4 hover:text-t1"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={pendingPlaybookId}
          onChange={(event) => setPendingPlaybookId(event.target.value)}
          aria-label="From playbook"
          className={cn(
            "h-7 rounded-md border border-border bg-bg-3 px-2 text-[11.5px] text-t2",
            "focus:border-primary focus:outline-none",
          )}
        >
          <option value="">From playbook…</option>
          {available.map((group) => (
            <option key={group.playbookId} value={group.playbookId}>
              {group.playbookName}
            </option>
          ))}
        </select>
        {activeGroup && activeGroup.outputs.length > 0 ? (
          <select
            value=""
            onChange={(event) => {
              if (event.target.value)
                onChange({
                  outputId: event.target.value,
                  playbookId: activeGroup.playbookId,
                });
            }}
            aria-label="Output"
            className={cn(
              "h-7 rounded-md border border-border bg-bg-3 px-2 text-[11.5px] text-t2",
              "focus:border-primary focus:outline-none",
            )}
          >
            <option value="">Output…</option>
            {activeGroup.outputs.map((output) => (
              <option key={output.id} value={output.id}>
                {output.name}
              </option>
            ))}
          </select>
        ) : null}
        {hasUpstreamTaskWithoutOutput ? (
          <span className="text-[11px] italic text-t3">(no output wired)</span>
        ) : null}
      </div>
      {activeGroup && activeGroup.outputs.length === 0 ? (
        <Link
          href="/framework/playbooks"
          className="text-[11px] text-accent hover:underline"
        >
          Declare an output on this playbook →
        </Link>
      ) : null}
    </div>
  );
}

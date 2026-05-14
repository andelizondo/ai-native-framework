"use client";

import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  PlaybookOutput,
  TaskOutput,
  WorkflowTaskStatus,
} from "@/lib/workflows/types";

import { IORow, type IORowChip, type IORowState } from "./io-row";

export interface OutputsSectionProps {
  status: WorkflowTaskStatus;
  outputDefs: PlaybookOutput[];
  outputStates: TaskOutput[];
  dimmed: boolean;
  busy: boolean;
  onProduce: (outputId: string) => void;
  onAddOutput?: () => void;
}

function chipFor(def: PlaybookOutput): { chip: IORowChip; chipLabel: string } {
  const kind = def.kind ?? "manual";
  const label = kind === "manual" ? "manual" : kind;
  return { chip: kind, chipLabel: label };
}

function stateFor(taskState: TaskOutput | undefined): IORowState {
  if (!taskState) return "pending";
  if (taskState.status === "produced") return "received";
  if (taskState.status === "failed") return "failed";
  if (taskState.status === "skipped") return "bypass";
  return "pending";
}

export function OutputsSection({
  status,
  outputDefs,
  outputStates,
  dimmed,
  busy,
  onProduce,
  onAddOutput,
}: OutputsSectionProps) {
  const stateById = new Map(outputStates.map((s) => [s.outputId, s]));
  const total = outputDefs.length;
  const done = outputDefs.filter(
    (def) => stateById.get(def.id)?.status === "produced",
  ).length;
  const isComplete = status === "complete";

  return (
    <section
      className={cn(
        "pb-drawer-sec",
        "pb-drawer-outputs",
        dimmed && "pb-drawer-sec--dimmed",
        isComplete && "pb-drawer-outputs--complete",
      )}
      data-testid="pb-drawer-outputs-section"
      data-complete={isComplete}
    >
      <div className="pb-drawer-sec__head">
        <div className="pb-drawer-sec__lbl">
          Outputs{" "}
          <span className="pb-drawer-sec__count">
            {done} / {total}
          </span>
        </div>
        {onAddOutput ? (
          <button
            type="button"
            className="pb-drawer-sec__action"
            onClick={onAddOutput}
            data-testid="pb-drawer-add-output-btn"
          >
            <Plus size={11} aria-hidden /> Add
          </button>
        ) : null}
      </div>
      <div className="pb-drawer-io-list">
        {outputDefs.length === 0 ? (
          <div className="pb-drawer-io-empty" data-testid="pb-drawer-outputs-empty">
            No outputs declared on this playbook.
          </div>
        ) : (
          outputDefs.map((def) => {
            const taskState = stateById.get(def.id);
            const state = stateFor(taskState);
            const { chip, chipLabel } = chipFor(def);
            return (
              <IORow
                key={def.id}
                kind="output"
                name={def.name}
                chip={chip}
                chipLabel={chipLabel}
                state={state}
                dimmed={dimmed}
                onAction={
                  state !== "received" && !busy
                    ? () => onProduce(def.id)
                    : undefined
                }
                testId={`pb-drawer-output-${def.id}`}
              />
            );
          })
        )}
      </div>
    </section>
  );
}

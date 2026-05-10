"use client";

import { useState } from "react";
import { Check, ChevronRight, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TaskInputState, WorkflowInput } from "@/lib/workflows/types";

import { IORow, type IORowChip, type IORowState } from "./io-row";

export interface InputsSectionProps {
  inputDefs: WorkflowInput[];
  inputStates: TaskInputState[];
  dimmed: boolean;
  busy: boolean;
  onMarkReceived: (inputId: string) => void;
  onAddInput?: () => void;
}

function chipFor(input: WorkflowInput): { chip: IORowChip; chipLabel: string } {
  if (input.linkMode === "linked") {
    return {
      chip: "linked",
      chipLabel: input.upstreamTaskRef ? `linked: ${input.upstreamTaskRef}` : "linked",
    };
  }
  if (input.linkMode === "bypass") {
    return { chip: "bypass", chipLabel: "bypass" };
  }
  return { chip: "manual", chipLabel: "manual" };
}

function stateFor(input: WorkflowInput, taskState: TaskInputState | undefined): IORowState {
  if (taskState?.received) return "received";
  if (input.linkMode === "bypass") return "bypass";
  return "pending";
}

export function InputsSection({
  inputDefs,
  inputStates,
  dimmed,
  busy,
  onMarkReceived,
  onAddInput,
}: InputsSectionProps) {
  const stateById = new Map(inputStates.map((s) => [s.inputId, s]));
  const linkedDefs = inputDefs.filter((i) => i.linkMode === "linked");
  const totalLinked = linkedDefs.length;
  const receivedLinked = linkedDefs.filter(
    (i) => stateById.get(i.id)?.received === true,
  ).length;
  const allLinkedReceived = totalLinked > 0 && receivedLinked === totalLinked;

  const totalAll = inputDefs.length;
  const receivedAll = inputDefs.filter((i) => stateById.get(i.id)?.received === true).length;

  // Collapsed by default once all linked inputs are received; user can
  // expand explicitly. We re-derive on every render so re-fetch flips it
  // back without explicit syncing.
  const [userExpanded, setUserExpanded] = useState(false);
  const collapsed = allLinkedReceived && !userExpanded;

  return (
    <section
      className={cn(
        "pb-drawer-sec",
        "pb-drawer-inputs",
        dimmed && "pb-drawer-sec--dimmed",
      )}
      data-testid="pb-drawer-inputs-section"
      data-collapsed={collapsed}
    >
      {collapsed ? (
        <button
          type="button"
          className="pb-drawer-collapse-toggle"
          onClick={() => setUserExpanded(true)}
          data-testid="pb-drawer-inputs-collapsed"
        >
          <span className="pb-drawer-collapse-toggle__left">
            <Check size={13} strokeWidth={2.5} aria-hidden />
            <span>
              <strong>All inputs received</strong>{" "}
              <span className="pb-drawer-collapse-toggle__count">
                {receivedAll} / {totalAll}
              </span>
            </span>
          </span>
          <ChevronRight
            size={14}
            className="pb-drawer-collapse-toggle__chev"
            aria-hidden
          />
        </button>
      ) : (
        <>
          <div className="pb-drawer-sec__head">
            <div className="pb-drawer-sec__lbl">
              Inputs{" "}
              <span className="pb-drawer-sec__count">
                {receivedAll} / {totalAll}
              </span>
            </div>
            {onAddInput ? (
              <button
                type="button"
                className="pb-drawer-sec__action"
                onClick={onAddInput}
                data-testid="pb-drawer-add-input-btn"
              >
                <Plus size={11} aria-hidden /> Add
              </button>
            ) : null}
          </div>
          <div className="pb-drawer-io-list">
            {inputDefs.length === 0 ? (
              <div className="pb-drawer-io-empty" data-testid="pb-drawer-inputs-empty">
                No inputs defined.
              </div>
            ) : (
              inputDefs.map((input) => {
                const taskState = stateById.get(input.id);
                const state = stateFor(input, taskState);
                const { chip, chipLabel } = chipFor(input);
                return (
                  <IORow
                    key={input.id}
                    kind="input"
                    name={input.name}
                    chip={chip}
                    chipLabel={chipLabel}
                    state={state}
                    sourceLabel={
                      state === "pending" && input.upstreamTaskRef
                        ? input.upstreamTaskRef
                        : undefined
                    }
                    dimmed={dimmed}
                    onAction={
                      state === "pending" && !busy
                        ? () => onMarkReceived(input.id)
                        : undefined
                    }
                    testId={`pb-drawer-input-${input.id}`}
                  />
                );
              })
            )}
          </div>
        </>
      )}
    </section>
  );
}

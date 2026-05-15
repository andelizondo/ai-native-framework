"use client";

import { useState } from "react";
import { Check, ChevronRight, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

type UserOverride = "expanded" | "collapsed" | null;
import type {
  PlaybookOutput,
  PlaybookOutputKind,
  TaskOutput,
  WorkflowTaskStatus,
} from "@/lib/workflows/types";

import { IORow, type IORowAvatar, type IORowState } from "./io-row";

export interface OutputsSectionProps {
  status: WorkflowTaskStatus;
  outputDefs: PlaybookOutput[];
  outputStates: TaskOutput[];
  dimmed: boolean;
  busy: boolean;
  /** True until the drawer has fetched its data the first time. Drives the
   *  skeleton rows so the section doesn't render an empty "No outputs"
   *  message and then jump to real rows when the fetch resolves. */
  loading?: boolean;
  onProduce: (outputId: string) => void;
  onAddOutput?: () => void;
}

/** Visual encoding per output kind: emoji + ring color the avatar uses
 *  in place of the previous text chip. Colors mirror the chip palette
 *  so the kind reads the same way at a glance. */
const KIND_AVATAR: Record<PlaybookOutputKind, { emoji: string; color: string }> = {
  file: { emoji: "📎", color: "var(--pill-active-d)" },
  media: { emoji: "🎬", color: "var(--pill-active-d)" },
  link: { emoji: "🔗", color: "var(--pill-active-d)" },
  api: { emoji: "🔌", color: "var(--pill-complete-d)" },
  manual: { emoji: "✏️", color: "var(--t3)" },
};

function avatarFor(def: PlaybookOutput): IORowAvatar {
  const kind = def.kind ?? "manual";
  const { emoji, color } = KIND_AVATAR[kind];
  return { emoji, color, label: `${kind} output` };
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
  loading = false,
  onProduce,
  onAddOutput,
}: OutputsSectionProps) {
  const stateById = new Map(outputStates.map((s) => [s.outputId, s]));
  const total = outputDefs.length;
  const done = outputDefs.filter(
    (def) => stateById.get(def.id)?.status === "produced",
  ).length;
  const isComplete = status === "complete";
  const allDone = total > 0 && done === total;
  const isEmpty = total === 0 && !loading;

  // Auto-collapse once the task is complete, or when no outputs are declared
  // at all — there's nothing to act on, so the section starts folded. User
  // override sticks for both directions.
  const [userOverride, setUserOverride] = useState<UserOverride>(null);
  const collapsed =
    userOverride === "collapsed" ||
    (userOverride === null && (isComplete || isEmpty));

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
      data-collapsed={collapsed}
    >
      <div className="pb-drawer-sec__head">
        <button
          type="button"
          className="pb-drawer-sec__toggle"
          onClick={() => setUserOverride(collapsed ? "expanded" : "collapsed")}
          aria-expanded={!collapsed}
          data-testid="pb-drawer-outputs-toggle"
        >
          <ChevronRight
            size={12}
            className={cn(
              "pb-drawer-sec__chev",
              !collapsed && "pb-drawer-sec__chev--open",
            )}
            aria-hidden
          />
          <span className="pb-drawer-sec__lbl">
            Outputs{" "}
            <span className="pb-drawer-sec__count">
              {done} / {total}
            </span>
            {allDone ? (
              <span className="pb-drawer-sec__done" aria-hidden>
                <Check size={11} strokeWidth={2.5} />
              </span>
            ) : null}
          </span>
        </button>
        {onAddOutput && !collapsed ? (
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
      {!collapsed ? (
        <div className="pb-drawer-io-list">
          {loading && outputDefs.length === 0 ? (
            <OutputsSkeleton />
          ) : outputDefs.length === 0 ? (
            <div className="pb-drawer-io-empty" data-testid="pb-drawer-outputs-empty">
              No outputs declared on this playbook.
            </div>
          ) : (
            outputDefs.map((def) => {
              const taskState = stateById.get(def.id);
              const state = stateFor(taskState);
              return (
                <IORow
                  key={def.id}
                  kind="output"
                  primaryLabel={def.name}
                  secondaryLabel={def.description ?? undefined}
                  avatar={avatarFor(def)}
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
      ) : null}
    </section>
  );
}

/** Two pulsing placeholder rows that match the real `IORow` footprint —
 *  avatar circle + 2-line label + meta column — so the section doesn't
 *  shift when the fetched outputs paint over them. */
function OutputsSkeleton() {
  return (
    <div data-testid="pb-drawer-outputs-skeleton" aria-hidden>
      {[0, 1].map((i) => (
        <div key={i} className="pb-drawer-io-row pb-drawer-io-row--skeleton">
          <div className="pb-drawer-io-skel-avatar" />
          <div className="pb-drawer-io-main">
            <div className="pb-drawer-io-skel-line pb-drawer-io-skel-line--name" />
            <div className="pb-drawer-io-skel-line pb-drawer-io-skel-line--sub" />
          </div>
          <div className="pb-drawer-io-skel-action" />
        </div>
      ))}
    </div>
  );
}

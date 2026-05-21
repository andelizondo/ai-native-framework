"use client";

import {
  Check,
  CheckCircle2,
  CircleAlert,
  Clock,
  Pause,
  Play,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  PlaybookOutput,
  WorkflowTask,
  WorkflowTaskStatus,
} from "@/lib/workflows/types";

export type ChatActionPanelKind =
  | "not_started"
  | "waiting"
  | "paused"
  | "failed"
  | "complete"
  | "in_progress";

interface PanelOption {
  label: string;
  onClick: () => void;
  testId?: string;
}

type PanelLayout = "row" | "stack";

interface PanelSpec {
  kind: ChatActionPanelKind;
  icon: LucideIcon;
  caption: string;
  layout: PanelLayout;
  options: PanelOption[];
}

export interface ChatActionPanelProps {
  task: WorkflowTask;
  hasUnmetInputs: boolean;
  pendingOutputs: PlaybookOutput[];
  hasOutputs: boolean;
  busy: boolean;
  onStart: () => void;
  onResume: () => void;
  onRetry: () => void;
  onRefine: () => void;
  onProduceOutput: (outputId: string) => void;
  onCompleteTask: () => void;
}

function specFor(
  status: WorkflowTaskStatus,
  hasUnmetInputs: boolean,
  pausedReason: string | null | undefined,
  pendingOutputs: PlaybookOutput[],
  hasOutputs: boolean,
  handlers: Pick<
    ChatActionPanelProps,
    | "onStart"
    | "onResume"
    | "onRetry"
    | "onRefine"
    | "onProduceOutput"
    | "onCompleteTask"
  >,
): PanelSpec | null {
  if (status === "not_started") {
    return {
      kind: "not_started",
      icon: Play,
      caption: "Ready to start.",
      layout: "row",
      options: [
        {
          label: "Start playbook",
          onClick: handlers.onStart,
          testId: "pb-drawer-chat-options-primary",
        },
      ],
    };
  }
  if (status === "waiting") {
    if (hasUnmetInputs) {
      return {
        kind: "waiting",
        icon: Clock,
        caption: "Waiting on upstream inputs.",
        layout: "row",
        options: [],
      };
    }
    return {
      kind: "waiting",
      icon: Clock,
      caption: "Inputs ready. You can kick this off.",
      layout: "row",
      options: [
        {
          label: "Start playbook",
          onClick: handlers.onStart,
          testId: "pb-drawer-chat-options-primary",
        },
      ],
    };
  }
  if (status === "paused") {
    const reason = pausedReason?.trim();
    return {
      kind: "paused",
      icon: Pause,
      caption:
        reason === "checkpoint"
          ? "Agent needs your sign-off before proceeding."
          : "This task is paused.",
      layout: "row",
      options: [
        {
          label: "Resume",
          onClick: handlers.onResume,
          testId: "pb-drawer-resume-btn",
        },
      ],
    };
  }
  if (status === "failed") {
    return {
      kind: "failed",
      icon: CircleAlert,
      caption: "Agent stopped before producing all outputs.",
      layout: "row",
      options: [
        {
          label: "Retry",
          onClick: handlers.onRetry,
          testId: "pb-drawer-retry-btn",
        },
      ],
    };
  }
  if (status === "in_progress") {
    if (pendingOutputs.length > 0) {
      return {
        kind: "in_progress",
        icon: Check,
        caption:
          pendingOutputs.length === 1
            ? "One output left to deliver."
            : `${pendingOutputs.length} outputs left to deliver.`,
        layout: "stack",
        options: pendingOutputs.map((output, idx) => ({
          label: output.name,
          onClick: () => handlers.onProduceOutput(output.id),
          testId:
            idx === 0
              ? "pb-drawer-chat-options-primary"
              : `pb-drawer-chat-options-output-${output.id}`,
        })),
      };
    }
    return {
      kind: "in_progress",
      icon: CheckCircle2,
      caption: hasOutputs
        ? "All outputs delivered. Ready to complete this task?"
        : "Ready to complete this task?",
      layout: "row",
      options: [
        {
          label: "Complete task",
          onClick: handlers.onCompleteTask,
          testId: "pb-drawer-chat-options-primary",
        },
      ],
    };
  }
  if (status === "complete") {
    return {
      kind: "complete",
      icon: Sparkles,
      caption: "Run complete. Capture what you learned.",
      layout: "row",
      options: [
        {
          label: "Refine playbook",
          onClick: handlers.onRefine,
          testId: "pb-drawer-refine-btn",
        },
      ],
    };
  }
  return null;
}

export function ChatActionPanel({
  task,
  hasUnmetInputs,
  pendingOutputs,
  hasOutputs,
  busy,
  onStart,
  onResume,
  onRetry,
  onRefine,
  onProduceOutput,
  onCompleteTask,
}: ChatActionPanelProps) {
  const spec = specFor(
    task.status,
    hasUnmetInputs,
    task.pausedReason,
    pendingOutputs,
    hasOutputs,
    {
      onStart,
      onResume,
      onRetry,
      onRefine,
      onProduceOutput,
      onCompleteTask,
    },
  );

  if (!spec) return null;

  const Icon = spec.icon;

  return (
    <div
      className={cn(
        "pb-drawer-chat-options",
        `pb-drawer-chat-options--${spec.kind}`,
      )}
      data-testid="pb-drawer-chat-options"
      data-kind={spec.kind}
      data-layout={spec.layout}
    >
      <div className="pb-drawer-chat-options__head">
        <Icon size={13} aria-hidden />
        <span>{spec.caption}</span>
      </div>
      {spec.options.length > 0 ? (
        <div
          className={cn(
            "pb-drawer-chat-options__row",
            spec.layout === "stack" && "pb-drawer-chat-options__row--stack",
          )}
        >
          {spec.options.map((option) => (
            <button
              key={option.label}
              type="button"
              className={cn(
                "pb-drawer-chat-options__chip",
                spec.layout === "stack" &&
                  "pb-drawer-chat-options__chip--stacked",
              )}
              onClick={option.onClick}
              disabled={busy}
              data-testid={option.testId}
            >
              {spec.layout === "stack" ? (
                <Check
                  size={12}
                  aria-hidden
                  className="pb-drawer-chat-options__chip-icon"
                />
              ) : null}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

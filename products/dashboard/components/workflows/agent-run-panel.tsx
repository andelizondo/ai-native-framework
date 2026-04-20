"use client";

import { useEffect, useTransition } from "react";
import { X } from "lucide-react";

import {
  approveDrawerCheckpointAction,
  rejectDrawerCheckpointAction,
} from "@/app/(dashboard)/workflows/actions";
import { captureError } from "@/lib/monitoring";
import { emitEvent } from "@/lib/events";
import { cn } from "@/lib/utils";
import type { WorkflowInstanceDetail, WorkflowTask } from "@/lib/workflows/types";

// ── Seed data types ───────────────────────────────────────────────────────────

type StepStatus = "done" | "active" | "waiting" | "pending";

interface AgentRunOutput {
  kind: "ok" | "info" | "muted";
  text: string;
}

interface AgentRunStep {
  id: string;
  label: string;
  status: StepStatus;
  duration?: string;
  output?: AgentRunOutput[];
}

interface AgentRun {
  agentName: string;
  skill: string;
  playbook: string;
  steps: AgentRunStep[];
  /** When true the waiting step renders a checkpoint card. */
  checkpoint: boolean;
  checkpointSubstatus?: string;
}

// ── Seed ─────────────────────────────────────────────────────────────────────
// Seed data used until real agent integration lands (later PR).
// Two variants: a running run and a checkpoint-waiting run.

const SEED_RUNNING: AgentRun = {
  agentName: "PM Agent",
  skill: "pm",
  playbook: "backlog-refinement",
  checkpoint: false,
  steps: [
    {
      id: "s1",
      label: "Load spec and context",
      status: "done",
      duration: "0m 12s",
      output: [
        { kind: "ok",   text: "✓ Loaded platform-product.yaml" },
        { kind: "info", text: "  Reading interfaces.yaml contracts..." },
        { kind: "ok",   text: "✓ Context loaded — 3 prior events found" },
      ],
    },
    {
      id: "s2",
      label: "Analyse stakeholders and scope",
      status: "done",
      duration: "1m 08s",
      output: [
        { kind: "ok",   text: "✓ Identified 4 key stakeholders" },
        { kind: "info", text: "  Finance approval path: 2 gates" },
        { kind: "ok",   text: "✓ Risk classification: medium" },
      ],
    },
    {
      id: "s3",
      label: "Draft acceptance criteria",
      status: "active",
      output: [
        { kind: "ok",    text: "✓ Scope outline complete" },
        { kind: "muted", text: "  Drafting criteria..." },
      ],
    },
    { id: "s4", label: "Validate against framework policy", status: "pending" },
    { id: "s5", label: "Surface for founder review",        status: "pending" },
  ],
};

const SEED_CHECKPOINT: AgentRun = {
  agentName: "PM Agent",
  skill: "pm",
  playbook: "backlog-refinement",
  checkpoint: true,
  checkpointSubstatus: "Agent needs your sign-off before proceeding to drafting.",
  steps: [
    {
      id: "s1",
      label: "Load spec and context",
      status: "done",
      duration: "0m 12s",
      output: [
        { kind: "ok",   text: "✓ Loaded platform-product.yaml" },
        { kind: "ok",   text: "✓ Context loaded — 3 prior events found" },
      ],
    },
    {
      id: "s2",
      label: "Analyse stakeholders and scope",
      status: "done",
      duration: "1m 08s",
      output: [
        { kind: "ok",   text: "✓ Identified 4 key stakeholders" },
        { kind: "ok",   text: "✓ Risk classification: medium" },
      ],
    },
    {
      id: "s3",
      label: "Request founder checkpoint",
      status: "waiting",
      output: [
        { kind: "muted", text: "  Awaiting approval..." },
      ],
    },
    { id: "s4", label: "Draft acceptance criteria",         status: "pending" },
    { id: "s5", label: "Surface for founder review",        status: "pending" },
  ],
};

// ── Step icon ─────────────────────────────────────────────────────────────────

export function stepStatusIcon(status: StepStatus): { symbol: string; className: string } {
  switch (status) {
    case "done":    return { symbol: "✓", className: "arp-step-icon--done" };
    case "active":  return { symbol: "●", className: "arp-step-icon--active" };
    case "waiting": return { symbol: "⏳", className: "arp-step-icon--waiting" };
    default:        return { symbol: "○", className: "arp-step-icon--pending" };
  }
}

// ── Elapsed time ──────────────────────────────────────────────────────────────

function formatElapsed(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  return `${h}h ${m}m`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AgentRunPanelProps {
  /** null = panel closed */
  task: WorkflowTask | null;
  instance: WorkflowInstanceDetail;
  open: boolean;
  onClose: () => void;
  onTaskUpdate: (task: WorkflowTask) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AgentRunPanel({
  task,
  instance,
  open,
  onClose,
  onTaskUpdate,
}: AgentRunPanelProps) {
  const [isPending, startTransition] = useTransition();

  // Analytics on open.
  useEffect(() => {
    if (open && task) {
      emitEvent("dashboard.agent_run_opened", { task_id: task.id });
    }
  }, [open, task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) {
    return <div className="arp" aria-hidden />;
  }

  // Choose seed run based on task checkpoint state.
  const run: AgentRun = task.checkpoint ? SEED_CHECKPOINT : SEED_RUNNING;

  // Derive display values from live task data.
  const agentName = task.agent ?? run.agentName;
  const skill     = task.skill ?? run.skill;
  const playbook  = task.playbook ?? run.playbook;
  const elapsed   = formatElapsed(task.updatedAt);
  const doneCount = run.steps.filter((s) => s.status === "done").length;
  const totalSteps = run.steps.length;

  function handleApprove() {
    startTransition(async () => {
      try {
        const { task: updated } = await approveDrawerCheckpointAction(task!.id);
        onTaskUpdate(updated);
        emitEvent("workflow.checkpoint_approved", {
          task_id: task!.id,
          instance_id: instance.id,
        });
      } catch (err) {
        captureError(err, { feature: "agent_run_panel.approve", extra: { task_id: task!.id } });
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      try {
        await rejectDrawerCheckpointAction(task!.id);
        emitEvent("workflow.checkpoint_rejected", {
          task_id: task!.id,
          instance_id: instance.id,
        });
      } catch (err) {
        captureError(err, { feature: "agent_run_panel.reject", extra: { task_id: task!.id } });
      }
    });
  }

  const isApproved = task.status === "active" && task.checkpoint;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Agent run: ${task.title}`}
      className={cn("arp", open && "arp--open")}
      data-testid="agent-run-panel"
    >
      {/* Header */}
      <header className="arp-header">
        <div className="arp-header-top">
          <div className="arp-agent-row">
            <span className="arp-agent-name">{agentName}</span>
            <span className="arp-meta-sep" aria-hidden>·</span>
            <span className="arp-skill-playbook">
              {skill}
              <span className="arp-meta-sep" aria-hidden> / </span>
              {playbook}
            </span>
          </div>
          <button
            type="button"
            className="arp-close"
            aria-label="Close agent run panel"
            onClick={onClose}
            data-testid="agent-run-panel-close"
          >
            <X size={13} aria-hidden />
          </button>
        </div>

        <div className="arp-breadcrumb">
          <span className="arp-crumb">{instance.label}</span>
          <span className="arp-crumb-sep" aria-hidden>›</span>
          <span className="arp-crumb">{task.title}</span>
        </div>

        <div className="arp-run-meta">
          Running {elapsed}
          <span className="arp-meta-sep" aria-hidden>·</span>
          {doneCount}/{totalSteps} steps
        </div>
      </header>

      {/* Body */}
      <div className="arp-body" data-testid="agent-run-body">
        {run.steps.map((step) => {
          const icon = stepStatusIcon(step.status);
          const isWaiting = step.status === "waiting";
          const showCheckpointCard = isWaiting && run.checkpoint;

          return (
            <div
              key={step.id}
              className={cn("arp-step", `arp-step--${step.status}`)}
              data-testid={`arp-step-${step.id}`}
            >
              {/* Step row */}
              <div className="arp-step-row">
                <span
                  className={cn("arp-step-icon", icon.className)}
                  aria-hidden
                >
                  {icon.symbol}
                </span>
                <span className={cn(
                  "arp-step-label",
                  step.status === "pending" && "arp-step-label--pending",
                )}>
                  {step.label}
                </span>
                {step.duration && (
                  <span className="arp-step-dur">{step.duration}</span>
                )}
                {step.status === "active" && (
                  <span className="arp-live-pill" aria-label="live">live</span>
                )}
              </div>

              {/* Output block */}
              {step.output && step.output.length > 0 && (
                <div className="arp-output" data-testid={`arp-output-${step.id}`}>
                  {step.output.map((line, i) => (
                    <div
                      key={i}
                      className={cn("arp-output-line", `arp-output-line--${line.kind}`)}
                    >
                      {line.text}
                    </div>
                  ))}
                </div>
              )}

              {/* Checkpoint card */}
              {showCheckpointCard && (
                <div className="arp-checkpoint-card" data-testid="arp-checkpoint-card">
                  <div className="arp-cp-heading">⚠ Checkpoint</div>
                  {run.checkpointSubstatus && (
                    <div className="arp-cp-sub">{run.checkpointSubstatus}</div>
                  )}
                  {isApproved ? (
                    <div className="arp-cp-approved" data-testid="arp-cp-approved">
                      ✓ Approved
                    </div>
                  ) : (
                    <div className="arp-cp-actions">
                      <button
                        type="button"
                        className="arp-cp-btn arp-cp-btn--approve"
                        disabled={isPending}
                        onClick={handleApprove}
                        data-testid="arp-approve-btn"
                      >
                        {isPending ? "…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        className="arp-cp-btn arp-cp-btn--reject"
                        disabled={isPending}
                        onClick={handleReject}
                        data-testid="arp-reject-btn"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

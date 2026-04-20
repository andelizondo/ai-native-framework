"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, ChevronUp, X } from "lucide-react";

import {
  approveDrawerCheckpointAction,
  rejectDrawerCheckpointAction,
} from "@/app/(dashboard)/workflows/actions";
import { captureError } from "@/lib/monitoring";
import { emitEvent } from "@/lib/events";
import { cn } from "@/lib/utils";
import type { WorkflowInstanceDetail, WorkflowTask } from "@/lib/workflows/types";

// ── Seed data types ───────────────────────────────────────────────────────────

export type StepStatus = "done" | "active" | "waiting" | "failed" | "pending";

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
  checkpoint: boolean;
  checkpointSubstatus?: string;
}

// ── Seed ─────────────────────────────────────────────────────────────────────

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
        { kind: "ok", text: "✓ Loaded platform-product.yaml" },
        { kind: "ok", text: "✓ Context loaded — 3 prior events found" },
      ],
    },
    {
      id: "s2",
      label: "Analyse stakeholders and scope",
      status: "done",
      duration: "1m 08s",
      output: [
        { kind: "ok", text: "✓ Identified 4 key stakeholders" },
        { kind: "ok", text: "✓ Risk classification: medium" },
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
    { id: "s4", label: "Draft acceptance criteria", status: "pending" },
    { id: "s5", label: "Surface for founder review", status: "pending" },
  ],
};

const SEED_COMPLETE: AgentRun = {
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
        { kind: "ok", text: "✓ Loaded platform-product.yaml" },
        { kind: "ok", text: "✓ Context loaded — 3 prior events found" },
      ],
    },
    {
      id: "s2",
      label: "Analyse stakeholders and scope",
      status: "done",
      duration: "1m 08s",
      output: [
        { kind: "ok", text: "✓ Identified 4 key stakeholders" },
        { kind: "ok", text: "✓ Risk classification: medium" },
      ],
    },
    {
      id: "s3",
      label: "Draft acceptance criteria",
      status: "done",
      duration: "2m 34s",
      output: [
        { kind: "ok", text: "✓ 6 acceptance criteria drafted" },
        { kind: "ok", text: "✓ Aligned with framework policy" },
      ],
    },
    {
      id: "s4",
      label: "Validate against framework policy",
      status: "done",
      duration: "0m 45s",
      output: [
        { kind: "ok", text: "✓ All criteria pass policy gate" },
      ],
    },
    {
      id: "s5",
      label: "Surface for founder review",
      status: "done",
      duration: "0m 05s",
      output: [
        { kind: "ok", text: "✓ Checkpoint raised for founder review" },
      ],
    },
  ],
};

const SEED_FAILED: AgentRun = {
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
        { kind: "ok", text: "✓ Loaded platform-product.yaml" },
        { kind: "ok", text: "✓ Context loaded — 3 prior events found" },
      ],
    },
    {
      id: "s2",
      label: "Analyse stakeholders and scope",
      status: "done",
      duration: "1m 08s",
      output: [
        { kind: "ok", text: "✓ Identified 4 key stakeholders" },
        { kind: "ok", text: "✓ Risk classification: medium" },
      ],
    },
    {
      id: "s3",
      label: "Draft acceptance criteria",
      status: "failed",
      duration: "0m 52s",
      output: [
        { kind: "muted", text: "  Error: Policy validation failed" },
        { kind: "muted", text: "  Missing required gate: finance-approval" },
      ],
    },
    { id: "s4", label: "Validate against framework policy", status: "pending" },
    { id: "s5", label: "Surface for founder review",        status: "pending" },
  ],
};

// Not-started preview — all steps as a plan, no output yet
const SEED_NOT_STARTED: AgentRun = {
  agentName: "PM Agent",
  skill: "pm",
  playbook: "backlog-refinement",
  checkpoint: false,
  steps: [
    { id: "s1", label: "Load spec and context",             status: "pending" },
    { id: "s2", label: "Analyse stakeholders and scope",    status: "pending" },
    { id: "s3", label: "Draft acceptance criteria",         status: "pending" },
    { id: "s4", label: "Validate against framework policy", status: "pending" },
    { id: "s5", label: "Surface for founder review",        status: "pending" },
  ],
};

function pickSeedRun(task: WorkflowTask): AgentRun {
  if (task.status === "not_started") return SEED_NOT_STARTED;
  if (task.status === "complete")    return SEED_COMPLETE;
  if (task.status === "blocked")     return SEED_FAILED;
  if (task.checkpoint)               return SEED_CHECKPOINT;
  return SEED_RUNNING;
}

// ── Step icon ─────────────────────────────────────────────────────────────────

export function stepStatusIcon(status: StepStatus): { symbol: string; className: string } {
  switch (status) {
    case "done":    return { symbol: "✓", className: "arp-step-icon--done" };
    case "active":  return { symbol: "●", className: "arp-step-icon--active" };
    case "waiting": return { symbol: "⏳", className: "arp-step-icon--waiting" };
    case "failed":  return { symbol: "✗", className: "arp-step-icon--failed" };
    default:        return { symbol: "○", className: "arp-step-icon--pending" };
  }
}

// ── Initial expanded set ──────────────────────────────────────────────────────

function initialExpanded(task: WorkflowTask, steps: AgentRunStep[]): Set<string> {
  switch (task.status) {
    case "not_started":
      // All collapsed — preview mode
      return new Set();
    case "active":
    case "pending_approval":
      // Only the current active/waiting step
      return new Set(steps.filter((s) => s.status === "active" || s.status === "waiting").map((s) => s.id));
    case "complete":
      // All done steps expanded
      return new Set(steps.map((s) => s.id));
    case "blocked":
      // Done + failed steps expanded
      return new Set(steps.filter((s) => s.status === "done" || s.status === "failed").map((s) => s.id));
    default:
      return new Set();
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

function runMetaLabel(
  task: WorkflowTask,
  doneCount: number,
  totalSteps: number,
  elapsed: string,
): string {
  switch (task.status) {
    case "not_started":  return `${totalSteps} steps · not started`;
    case "complete":     return `Completed · ${totalSteps}/${totalSteps} steps`;
    case "blocked":      return `Failed · ${doneCount}/${totalSteps} steps`;
    case "active":       return `Running ${elapsed} · ${doneCount}/${totalSteps} steps`;
    default:             return `${doneCount}/${totalSteps} steps`;
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AgentRunPanelProps {
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
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [chatFocused, setChatFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const run = useMemo(() => (task ? pickSeedRun(task) : SEED_NOT_STARTED), [task?.id, task?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset expanded state whenever task or run changes.
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(
    () => (task ? initialExpanded(task, run.steps) : new Set()),
  );
  useEffect(() => {
    if (task) setExpandedSteps(initialExpanded(task, run.steps));
  }, [task?.id, task?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Analytics on open.
  useEffect(() => {
    if (open && task) {
      emitEvent("dashboard.agent_run_opened", { task_id: task.id });
    }
  }, [open, task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleStep(id: string) {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (!task) {
    return <div className="arp" aria-hidden />;
  }

  const agentName  = task.agent    ?? run.agentName;
  const skill      = task.skill    ?? run.skill;
  const playbook   = task.playbook ?? run.playbook;
  const elapsed    = formatElapsed(task.updatedAt);
  const doneCount  = run.steps.filter((s) => s.status === "done").length;
  const totalSteps = run.steps.length;
  const progressPct = totalSteps > 0 ? Math.round((doneCount / totalSteps) * 100) : 0;

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
        onClose();
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
      aria-hidden={!open}
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
          {runMetaLabel(task, doneCount, totalSteps, elapsed)}
        </div>

        <div className="arp-progress" aria-hidden>
          <div
            className={cn(
              "arp-progress-fill",
              task.status === "complete" && "arp-progress-fill--complete",
              task.status === "blocked"  && "arp-progress-fill--failed",
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      {/* Body */}
      <div className="arp-body" data-testid="agent-run-body">

        {/* Step list */}
        {run.steps.map((step) => {
          const icon = stepStatusIcon(step.status);
          const isExpanded = expandedSteps.has(step.id);
          const hasContent = (step.output && step.output.length > 0) ||
            (step.status === "waiting" && run.checkpoint);
          const isWaiting = step.status === "waiting";
          const showCheckpointCard = isWaiting && run.checkpoint;

          return (
            <div
              key={step.id}
              className={cn("arp-step", `arp-step--${step.status}`)}
              data-testid={`arp-step-${step.id}`}
            >
              {/* Step header — always visible, clickable when there's content */}
              <div
                className={cn(
                  "arp-step-row",
                  hasContent && "arp-step-row--toggle",
                  step.status === "active" && "arp-step-row--live",
                )}
                role={hasContent ? "button" : undefined}
                tabIndex={hasContent ? 0 : undefined}
                aria-expanded={hasContent ? isExpanded : undefined}
                onClick={hasContent ? () => toggleStep(step.id) : undefined}
                onKeyDown={hasContent ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleStep(step.id); } } : undefined}
              >
                <span className={cn("arp-step-icon", icon.className)} aria-hidden>
                  {icon.symbol}
                </span>
                <span className={cn(
                  "arp-step-label",
                  step.status === "pending" && "arp-step-label--pending",
                  step.status === "done"    && "arp-step-label--done",
                )}>
                  {step.label}
                </span>
                {step.duration && (
                  <span className="arp-step-dur">{step.duration}</span>
                )}
                {step.status === "active" && (
                  <span className="arp-live-pill" aria-label="live">live</span>
                )}
                {hasContent && (
                  <span className="arp-step-chevron" aria-hidden>
                    {isExpanded
                      ? <ChevronDown size={11} />
                      : <ChevronRight size={11} />}
                  </span>
                )}
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <>
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
                </>
              )}
            </div>
          );
        })}

        {/* Gates — rendered as a goal step at the end of the timeline */}
        {task.gates.length > 0 && (
          <div
            className={cn(
              "arp-step arp-step--gate",
              task.status === "complete" && "arp-step--gate-done",
            )}
            data-testid="arp-gate-step"
          >
            <div className="arp-step-row">
              <span
                className={cn(
                  "arp-step-icon",
                  task.status === "complete" ? "arp-step-icon--done" : "arp-step-icon--pending",
                )}
                aria-hidden
              >
                {task.status === "complete" ? "✓" : "◇"}
              </span>
              <span className={cn(
                "arp-step-label",
                task.status !== "complete" && "arp-step-label--pending",
              )}>
                {task.gates.map((g) => g.label ?? g.type).join(" · ")}
              </span>
              {task.gates[0]?.type && (
                <span className="arp-gate-type-badge">{task.gates[0].type}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Chat footer */}
      <footer className={cn("arp-chat-footer", chatFocused && "arp-chat-footer--focused")}>
        <div className="arp-chat-box">
          <textarea
            ref={textareaRef}
            className="arp-chat-input"
            placeholder="Ask or instruct the agent…"
            rows={1}
            onFocus={() => setChatFocused(true)}
            onBlur={() => setChatFocused(false)}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                // TODO: wire to real agent integration
              }
            }}
          />
          <div className="arp-chat-toolbar">
            <div className="arp-model-select-wrap">
              <select
                className="arp-model-select"
                aria-label="Model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                <option value="claude-sonnet-4-6">Sonnet 4.6</option>
                <option value="claude-opus-4-7">Opus 4.7</option>
                <option value="claude-haiku-4-5">Haiku 4.5</option>
              </select>
              <ChevronDown size={10} className="arp-model-chevron" aria-hidden />
            </div>
            <button
              type="button"
              className="arp-chat-send"
              aria-label="Send message"
              data-testid="arp-chat-send"
            >
              <ChevronUp size={14} aria-hidden />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

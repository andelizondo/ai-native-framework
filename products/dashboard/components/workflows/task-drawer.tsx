"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, BookOpen, Bot, X, Zap } from "lucide-react";

import { captureError } from "@/lib/monitoring";
import { emitEvent } from "@/lib/events";
import { cn } from "@/lib/utils";
import type {
  WorkflowEvent,
  WorkflowGate,
  WorkflowInstanceDetail,
  WorkflowRole,
  WorkflowTask,
  WorkflowTemplate,
  WorkflowTrigger,
} from "@/lib/workflows/types";
import {
  approveDrawerCheckpointAction,
  rejectDrawerCheckpointAction,
  updateTaskTriggerGatesAction,
} from "@/app/(dashboard)/workflows/actions";

// ── TriggerGateEditor ─────────────────────────────────────────────────────────

const TRIGGER_TYPES = ["manual", "event", "task_complete", "schedule", "webhook"];
const GATE_TYPES = ["approval", "condition", "external", "timer"];

interface TriggerGateEditorProps {
  items: WorkflowTrigger[] | WorkflowGate[];
  kind: "trigger" | "gate";
  disabled?: boolean;
  onChange: (items: WorkflowTrigger[] | WorkflowGate[]) => void;
}

function TriggerGateEditor({ items, kind, disabled, onChange }: TriggerGateEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [pendingType, setPendingType] = useState(kind === "trigger" ? TRIGGER_TYPES[0]! : GATE_TYPES[0]!);
  const [pendingLabel, setPendingLabel] = useState("");

  const types = kind === "trigger" ? TRIGGER_TYPES : GATE_TYPES;

  function handleAdd() {
    if (!pendingLabel.trim()) return;
    const next = [
      ...items,
      { type: pendingType, label: pendingLabel.trim() },
    ];
    onChange(next);
    setPendingLabel("");
    setPendingType(types[0]!);
    setIsAdding(false);
  }

  function handleRemove(index: number) {
    const next = items.filter((_, i) => i !== index);
    onChange(next);
  }

  return (
    <div className="td-section" data-testid={`tg-editor-${kind}`}>
      <span className="td-section-label">
        {kind === "trigger" ? "Triggers" : "Gates"}
      </span>
      <div className="tg-list">
        {items.map((item, i) => (
          <div key={i} className="tg-item" data-testid={`tg-item-${kind}-${i}`}>
            <span className="tg-item-type">{item.type}</span>
            <span className="tg-item-label">{item.label ?? item.type}</span>
            <button
              type="button"
              className="tg-item-remove"
              aria-label={`Remove ${kind}`}
              disabled={disabled}
              onClick={() => handleRemove(i)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {isAdding ? (
        <div className="tg-inline-form" data-testid={`tg-inline-form-${kind}`}>
          <div className="tg-inline-row">
            <select
              className="tg-select"
              value={pendingType}
              onChange={(e) => setPendingType(e.target.value)}
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              className="tg-input"
              placeholder="Label"
              value={pendingLabel}
              autoFocus
              onChange={(e) => setPendingLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") setIsAdding(false);
              }}
            />
          </div>
          <div className="tg-form-btns">
            <button
              type="button"
              className="tg-form-cancel"
              onClick={() => {
                setIsAdding(false);
                setPendingLabel("");
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="tg-form-save"
              disabled={!pendingLabel.trim()}
              onClick={handleAdd}
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="tg-add-btn"
          disabled={disabled}
          onClick={() => setIsAdding(true)}
          data-testid={`tg-add-${kind}`}
        >
          + Add {kind}
        </button>
      )}
    </div>
  );
}

// ── Primary action card ───────────────────────────────────────────────────────

interface PrimaryActionProps {
  task: WorkflowTask;
  isPending: boolean;
  onApprove: () => void;
  onReject: () => void;
}

function PrimaryActionCard({ task, isPending, onApprove, onReject }: PrimaryActionProps) {
  if (task.status === "pending_approval") {
    return (
      <div className="td-action-card" data-testid="td-action-card">
        <div className="td-action-btns">
          <button
            type="button"
            className="td-btn td-btn-approve"
            disabled={isPending}
            onClick={onApprove}
            data-testid="td-approve-btn"
          >
            ✓ Approve &amp; continue
          </button>
          <button
            type="button"
            className="td-btn td-btn-reject"
            disabled={isPending}
            onClick={onReject}
            data-testid="td-reject-btn"
          >
            Reject
          </button>
        </div>
      </div>
    );
  }

  if (task.status === "not_started") {
    return (
      <div className="td-action-card" data-testid="td-action-card">
        <div className="td-action-btns">
          <button
            type="button"
            className="td-btn td-btn-primary"
            disabled={isPending}
            data-testid="td-start-btn"
          >
            ▶ Start agent
          </button>
        </div>
      </div>
    );
  }

  if (task.status === "active") {
    return (
      <div className="td-action-card" data-testid="td-action-card">
        <div className="td-action-btns">
          <button
            type="button"
            className="td-btn td-btn-outline"
            disabled={isPending}
            data-testid="td-view-run-btn"
          >
            View live run
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ── Details tab ───────────────────────────────────────────────────────────────

const STATUS_BORDER: Record<WorkflowTask["status"], string> = {
  complete: "#10b981",
  active: "#6366f1",
  pending_approval: "#f59e0b",
  blocked: "#ef4444",
  not_started: "var(--border)",
};

const STATUS_LABEL: Record<WorkflowTask["status"], string> = {
  complete: "Complete",
  active: "Active",
  pending_approval: "Pending approval",
  blocked: "Blocked",
  not_started: "Not started",
};

interface DetailsTabProps {
  task: WorkflowTask;
  isPending: boolean;
  onApprove: () => void;
  onReject: () => void;
  onTriggersChange: (triggers: WorkflowTrigger[]) => void;
  onGatesChange: (gates: WorkflowGate[]) => void;
}

function DetailsTab({
  task,
  isPending,
  onApprove,
  onReject,
  onTriggersChange,
  onGatesChange,
}: DetailsTabProps) {
  const statusColor = STATUS_BORDER[task.status];

  return (
    <>
      {/* Primary action */}
      <PrimaryActionCard
        task={task}
        isPending={isPending}
        onApprove={onApprove}
        onReject={onReject}
      />

      {/* Status */}
      <div className="td-section">
        <span className="td-section-label">Status</span>
        <div
          className="td-status-card"
          style={{ borderLeftColor: statusColor }}
          data-testid="td-status-card"
        >
          <div className={cn("s-pill", `s-${task.status}`)} style={{ alignSelf: "flex-start" }}>
            <div className="s-dot" aria-hidden />
            <div className="s-text">{STATUS_LABEL[task.status]}</div>
          </div>
          {task.substatus && (
            <div style={{ fontSize: 11, color: "var(--t3)" }}>{task.substatus}</div>
          )}
        </div>
      </div>

      {/* Checkpoint */}
      {task.checkpoint && task.status === "pending_approval" && (
        <div className="td-checkpoint-card" data-testid="td-checkpoint-card">
          <AlertTriangle size={13} aria-hidden />
          Requesting approval to proceed.
        </div>
      )}

      {/* Skills */}
      {(task.agent || task.skill) && (
        <div className="td-section">
          <span className="td-section-label">Skills</span>
          <div className="td-row">
            <div className="td-row-icon">
              <Bot size={12} aria-hidden />
            </div>
            {task.agent && (
              <span className="td-row-name">{task.agent}</span>
            )}
            {task.skill && (
              <span className="td-row-mono">{task.skill}</span>
            )}
            <div
              className={cn(
                "td-pulse-dot",
                task.status === "active"
                  ? "td-pulse-active"
                  : task.status === "pending_approval"
                    ? "td-pulse-pending"
                    : "td-pulse-idle",
              )}
              aria-hidden
            />
          </div>
        </div>
      )}

      {/* Playbook */}
      {task.playbook && (
        <div className="td-section">
          <span className="td-section-label">Playbook</span>
          <div className="td-row">
            <div className="td-row-icon">
              <BookOpen size={12} aria-hidden />
            </div>
            <span className="td-row-mono" style={{ color: "var(--accent)" }}>
              {task.playbook}
            </span>
          </div>
        </div>
      )}

      {/* Triggers */}
      <TriggerGateEditor
        items={task.triggers}
        kind="trigger"
        disabled={isPending}
        onChange={(items) => onTriggersChange(items as WorkflowTrigger[])}
      />

      {/* Gates */}
      <TriggerGateEditor
        items={task.gates}
        kind="gate"
        disabled={isPending}
        onChange={(items) => onGatesChange(items as WorkflowGate[])}
      />
    </>
  );
}

// ── Events tab ────────────────────────────────────────────────────────────────

interface EventsTabProps {
  events: WorkflowEvent[];
}

function EventsTab({ events }: EventsTabProps) {
  if (events.length === 0) {
    return (
      <div className="td-empty" data-testid="td-events-empty">
        No events recorded for this task yet.
      </div>
    );
  }

  return (
    <div className="td-event-list" data-testid="td-event-list">
      {events.map((ev) => (
        <div key={ev.id} className="td-event-item" data-testid={`td-event-${ev.id}`}>
          <div className="td-event-name">{ev.name}</div>
          {ev.description && (
            <div className="td-event-desc">{ev.description}</div>
          )}
          <div className="td-event-time">
            {new Date(ev.createdAt).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Dependencies tab ──────────────────────────────────────────────────────────

function DependenciesTab() {
  return (
    <div className="td-empty" data-testid="td-dependencies-placeholder">
      DepTree coming in PR 10
    </div>
  );
}

// ── Main TaskDrawer ───────────────────────────────────────────────────────────

type DrawerTab = "details" | "events" | "dependencies";

export interface TaskDrawerProps {
  task: WorkflowTask;
  instance: WorkflowInstanceDetail;
  roles: WorkflowRole[];
  template: WorkflowTemplate | null;
  onClose: () => void;
  onTaskUpdate: (task: WorkflowTask) => void;
}

export function TaskDrawer({
  task,
  instance,
  roles,
  template,
  onClose,
  onTaskUpdate,
}: TaskDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>("details");
  const [isPending, startTransition] = useTransition();

  const roleLabel = roles.find((r) => r.id === task.roleId)?.label ?? task.roleId;
  const stageLabel =
    template?.stages.find((s) => s.id === task.stageId)?.label ?? task.stageId;
  const taskEvents = instance.events.filter((e) => e.taskId === task.id);

  // Analytics event on open
  useEffect(() => {
    emitEvent("dashboard.task_drawer_opened", { task_id: task.id });
  }, [task.id]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function handleApprove() {
    startTransition(async () => {
      try {
        const { task: updated } = await approveDrawerCheckpointAction(task.id);
        onTaskUpdate(updated);
        emitEvent("workflow.checkpoint_approved", {
          task_id: task.id,
          instance_id: task.instanceId,
        });
      } catch (err) {
        captureError(err, {
          feature: "workflows.drawer_approve",
          extra: { task_id: task.id },
        });
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      try {
        await rejectDrawerCheckpointAction(task.id);
        emitEvent("workflow.checkpoint_rejected", {
          task_id: task.id,
          instance_id: task.instanceId,
        });
      } catch (err) {
        captureError(err, {
          feature: "workflows.drawer_reject",
          extra: { task_id: task.id },
        });
      }
    });
  }

  function handleTriggersChange(triggers: WorkflowTrigger[]) {
    startTransition(async () => {
      try {
        const { task: updated } = await updateTaskTriggerGatesAction(
          task.id,
          triggers,
          task.gates,
        );
        onTaskUpdate(updated);
      } catch (err) {
        captureError(err, {
          feature: "workflows.trigger_gate_update",
          extra: { task_id: task.id },
        });
      }
    });
  }

  function handleGatesChange(gates: WorkflowGate[]) {
    startTransition(async () => {
      try {
        const { task: updated } = await updateTaskTriggerGatesAction(
          task.id,
          task.triggers,
          gates,
        );
        onTaskUpdate(updated);
      } catch (err) {
        captureError(err, {
          feature: "workflows.trigger_gate_update",
          extra: { task_id: task.id },
        });
      }
    });
  }

  return (
    <>
      {/* Overlay — closes drawer on click */}
      <div
        className="task-drawer-overlay"
        aria-hidden
        data-testid="task-drawer-overlay"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Task: ${task.title}`}
        className="task-drawer"
        data-testid="task-drawer"
      >
        {/* Header */}
        <header className="td-header">
          <div className="td-breadcrumb">
            <span>{instance.label}</span>
            <span aria-hidden>›</span>
            <span>{stageLabel}</span>
            <span aria-hidden>›</span>
            <span>{roleLabel}</span>
          </div>
          <div className="td-header-top">
            <h2 className="td-title">{task.title}</h2>
            <button
              type="button"
              className="td-close"
              aria-label="Close task drawer"
              onClick={onClose}
              data-testid="task-drawer-close"
            >
              <X size={13} aria-hidden />
            </button>
          </div>

          {/* Tab bar */}
          <div className="td-tabs" role="tablist" aria-label="Task sections">
            {(["details", "dependencies", "events"] as const).map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                className={cn("td-tab", activeTab === tab && "td-tab-active")}
                onClick={() => setActiveTab(tab)}
                data-testid={`td-tab-${tab}`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === "events" && taskEvents.length > 0
                  ? ` (${taskEvents.length})`
                  : ""}
              </button>
            ))}
          </div>
        </header>

        {/* Body */}
        <div className="td-body" role="tabpanel" data-testid="td-body">
          {activeTab === "details" && (
            <DetailsTab
              task={task}
              isPending={isPending}
              onApprove={handleApprove}
              onReject={handleReject}
              onTriggersChange={handleTriggersChange}
              onGatesChange={handleGatesChange}
            />
          )}
          {activeTab === "events" && <EventsTab events={taskEvents} />}
          {activeTab === "dependencies" && <DependenciesTab />}
        </div>
      </div>
    </>
  );
}

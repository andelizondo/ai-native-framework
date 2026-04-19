"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { BookOpen, Check, Play, X, XCircle } from "lucide-react";

import { captureError } from "@/lib/monitoring";
import { emitEvent } from "@/lib/events";
import { cn } from "@/lib/utils";
import { getRoleColor } from "@/lib/workflows/role-colors";
import type {
  FrameworkItem,
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
  startTaskAction,
  updateTaskTriggerGatesAction,
} from "@/app/(dashboard)/workflows/actions";

// Emoji icons keyed by skill name — mirrors SKILL_ICONS in pc-components.jsx.
const SKILL_ICONS: Record<string, string> = {
  pm: "📋",
  builder: "⚡",
  devops: "🔧",
  "finance-ops": "💰",
  "sales-ops": "🤝",
  designer: "🎨",
  researcher: "🔍",
  strategist: "🧭",
  growth: "📈",
  qa: "✅",
  project: "🗂️",
  support: "🎧",
  "spec.review": "📋",
};

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
  const types = kind === "trigger" ? TRIGGER_TYPES : GATE_TYPES;
  const [pendingType, setPendingType] = useState(types[0]!);
  const [pendingLabel, setPendingLabel] = useState("");

  function handleAdd() {
    if (!pendingLabel.trim()) return;
    onChange([...items, { type: pendingType, label: pendingLabel.trim() }]);
    setPendingLabel("");
    setPendingType(types[0]!);
    setIsAdding(false);
  }

  function handleRemove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="td-sec" data-testid={`tg-editor-${kind}`}>
      <div className="td-sec-lbl">{kind === "trigger" ? "Triggers" : "Gates"}</div>
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
                <option key={t} value={t}>{t}</option>
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
              onClick={() => { setIsAdding(false); setPendingLabel(""); }}
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

// ── Details tab ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<WorkflowTask["status"], string> = {
  complete: "Complete",
  active: "Active",
  pending_approval: "Pending approval",
  blocked: "Blocked",
  not_started: "Not started",
};

const STATUS_PILL_CLASS: Record<WorkflowTask["status"], string> = {
  complete: "s-complete",
  active: "s-active",
  pending_approval: "s-pending",
  blocked: "s-blocked",
  not_started: "s-not_started",
};

interface DetailsTabProps {
  task: WorkflowTask;
  roles: WorkflowRole[];
  skillOptions: FrameworkItem[];
  playbookOptions: FrameworkItem[];
  isPending: boolean;
  onStart: () => void;
  onApprove: () => void;
  onReject: () => void;
  onTriggersChange: (triggers: WorkflowTrigger[]) => void;
  onGatesChange: (gates: WorkflowGate[]) => void;
}

function DetailsTab({
  task,
  roles,
  skillOptions,
  playbookOptions,
  isPending,
  onStart,
  onApprove,
  onReject,
  onTriggersChange,
  onGatesChange,
}: DetailsTabProps) {
  const isPendingApproval = task.status === "pending_approval";
  const isActive = task.status === "active";
  const isNotStarted = task.status === "not_started";
  const roleColor = getRoleColor(task.roleId, roles);
  const skillIcon = task.skill ? (SKILL_ICONS[task.skill] ?? "🤖") : "🤖";
  const skillItem = task.skill
    ? skillOptions.find((item) => item.name === task.skill || item.id === task.skill)
    : null;
  const playbookItem = task.playbook
    ? playbookOptions.find(
        (item) => item.name === task.playbook || item.id === task.playbook,
      )
    : null;
  const playbookDescription = playbookItem?.description?.trim();

  return (
    <>
      {/* 1. Status + Skill — two columns */}
      <div className="td-status-skill-row td-sec">
        <div className="td-status-col" data-testid="td-status-card">
          <div className="td-sec-lbl">Status</div>
          <div className={STATUS_PILL_CLASS[task.status]}>
            <div className="s-pill td-status-pill-xl">
              <div className="s-dot" aria-hidden />
              <div className="s-text">{STATUS_LABELS[task.status]}</div>
            </div>
          </div>
          {task.substatus && (
            <div className="td-substatus">{task.substatus}</div>
          )}
        </div>

        {(task.agent ?? task.skill) && (
          <div>
            <div className="td-sec-lbl">Skill</div>
            <div className="td-agent-profile">
              <div className="td-agent-profile-icon">{skillIcon}</div>
              <div className="td-agent-profile-info">
                <div className="td-agent-profile-name">
                  {skillItem?.name ?? task.skill ?? task.agent}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Approve / reject card — only for pending_approval */}
      {isPendingApproval && (
        <div className="td-action-top" data-testid="td-action-card">
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
            className="td-btn td-btn-ghost"
            disabled={isPending}
            onClick={onReject}
            data-testid="td-reject-btn"
          >
            Reject
          </button>
        </div>
      )}

      {/* Checkpoint notice */}
      {task.checkpoint && isPendingApproval && (
        <div className="td-sec">
          <div className="td-sec-lbl">Checkpoint</div>
          <div className="td-checkpoint-notice" data-testid="td-checkpoint-card">
            Requesting approval to proceed.
          </div>
        </div>
      )}

      {/* 3. Playbook — what is being run, with inline run state */}
      {task.playbook && (
        <div className="td-sec">
          <div className="td-sec-lbl">Playbook</div>
          <div
            className={cn("td-playbook", isActive && "td-playbook-active")}
            role={isActive ? "button" : undefined}
            tabIndex={isActive ? 0 : undefined}
            aria-label={isActive ? "View live run" : undefined}
            title={isActive ? "Live run view coming in PR 10" : undefined}
            data-testid={isActive ? "td-view-run-btn" : undefined}
          >
            <div className="td-pb-icon">
              {playbookItem?.icon ? (
                <span aria-hidden>{playbookItem.icon}</span>
              ) : (
                <BookOpen size={15} aria-hidden />
              )}
            </div>
            <div className="td-pb-info">
              <div className="td-pb-name">{playbookItem?.name ?? task.playbook}</div>
              <div
                className={cn(
                  "td-item-desc",
                  playbookDescription && "td-item-desc-plain",
                )}
              >
                {playbookDescription || "No description"}
              </div>
            </div>
            <div className="td-pb-action">
              {isNotStarted && (
                <button
                  type="button"
                  className="td-pb-run-btn"
                  disabled={isPending}
                  aria-label="Start playbook"
                  data-testid="td-start-btn"
                  onClick={onStart}
                >
                  <Play size={9} aria-hidden />
                </button>
              )}
              {isActive && (
                <div className="td-pb-state-busy" aria-label="Running" />
              )}
              {task.status === "complete" && (
                <div className="td-pb-state-done" aria-label="Done">
                  <Check size={10} aria-hidden />
                </div>
              )}
              {task.status === "blocked" && (
                <div className="td-pb-state-failed" aria-label="Failed">
                  <XCircle size={10} aria-hidden />
                </div>
              )}
            </div>
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

function EventsTab({ events }: { events: WorkflowEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="td-empty" data-testid="td-events-empty">
        No events yet.
      </div>
    );
  }

  return (
    <div className="td-sec" style={{ marginTop: 4 }}>
      <div className="td-sec-lbl">Event log</div>
      <div className="td-event-list" data-testid="td-event-list">
        {events.map((ev) => (
          <div key={ev.id} className="td-event-item" data-testid={`td-event-${ev.id}`}>
            <div className="td-event-dot" aria-hidden />
            <div>
              <div className="td-event-name">{ev.name}</div>
              {ev.description && (
                <div className="td-event-desc">{ev.description}</div>
              )}
              <div className="td-event-time">
                {new Date(ev.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dependencies tab ──────────────────────────────────────────────────────────

function DependenciesTab() {
  return (
    <div className="td-sec" style={{ marginTop: 4 }}>
      <div className="td-sec-lbl">Flow</div>
      <div className="td-empty" data-testid="td-dependencies-placeholder">
        DepTree coming in PR 14
      </div>
    </div>
  );
}

// ── Main TaskDrawer ───────────────────────────────────────────────────────────

type DrawerTab = "details" | "deps" | "events";

export interface TaskDrawerProps {
  /** null → closed (drawer stays in DOM for CSS slide-out animation). */
  task: WorkflowTask | null;
  instance: WorkflowInstanceDetail;
  roles: WorkflowRole[];
  template: WorkflowTemplate | null;
  skillOptions?: FrameworkItem[];
  playbookOptions?: FrameworkItem[];
  onClose: () => void;
  onTaskUpdate: (task: WorkflowTask) => void;
}

export function TaskDrawer({
  task,
  instance,
  roles,
  template,
  skillOptions = [],
  playbookOptions = [],
  onClose,
  onTaskUpdate,
}: TaskDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>("details");
  const [isPending, startTransition] = useTransition();
  const closeRef = useRef<HTMLButtonElement>(null);
  const open = !!task;

  // Reset to details tab whenever a different task is selected.
  useEffect(() => { setActiveTab("details"); }, [task?.id]);

  // Move focus into the drawer when it opens so the dialog is usable by
  // keyboard and screen-reader users without tabbing behind the overlay.
  useEffect(() => {
    if (open) {
      closeRef.current?.focus();
    }
  }, [open]);

  // Analytics event on open.
  useEffect(() => {
    if (task) {
      emitEvent("dashboard.task_drawer_opened", { task_id: task.id });
    }
  }, [task?.id]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  function handleStart() {
    if (!task) return;
    startTransition(async () => {
      try {
        const { task: updated } = await startTaskAction(task.id);
        onTaskUpdate(updated);
        emitEvent("workflow.task_started", {
          task_id: task.id,
          instance_id: task.instanceId,
        });
      } catch (err) {
        captureError(err, { feature: "workflows.start_task", extra: { task_id: task.id } });
      }
    });
  }

  function handleApprove() {
    if (!task) return;
    startTransition(async () => {
      try {
        const { task: updated } = await approveDrawerCheckpointAction(task.id);
        onTaskUpdate(updated);
        emitEvent("workflow.checkpoint_approved", {
          task_id: task.id,
          instance_id: task.instanceId,
        });
      } catch (err) {
        captureError(err, { feature: "workflows.drawer_approve", extra: { task_id: task.id } });
      }
    });
  }

  function handleReject() {
    if (!task) return;
    startTransition(async () => {
      try {
        await rejectDrawerCheckpointAction(task.id);
        emitEvent("workflow.checkpoint_rejected", {
          task_id: task.id,
          instance_id: task.instanceId,
        });
      } catch (err) {
        captureError(err, { feature: "workflows.drawer_reject", extra: { task_id: task.id } });
      }
    });
  }

  function handleTriggersChange(triggers: WorkflowTrigger[]) {
    if (!task) return;
    startTransition(async () => {
      try {
        const { task: updated } = await updateTaskTriggerGatesAction(task.id, triggers, task.gates);
        onTaskUpdate(updated);
      } catch (err) {
        captureError(err, { feature: "workflows.trigger_gate_update", extra: { task_id: task.id } });
      }
    });
  }

  function handleGatesChange(gates: WorkflowGate[]) {
    if (!task) return;
    startTransition(async () => {
      try {
        const { task: updated } = await updateTaskTriggerGatesAction(task.id, task.triggers, gates);
        onTaskUpdate(updated);
      } catch (err) {
        captureError(err, { feature: "workflows.trigger_gate_update", extra: { task_id: task.id } });
      }
    });
  }

  const roleLabel = task ? (roles.find((r) => r.id === task.roleId)?.label ?? task.roleId) : "";
  const stageLabel = task
    ? (template?.stages.find((s) => s.id === task.stageId)?.label ?? task.stageId)
    : "";
  const taskEvents = task ? instance.events.filter((e) => e.taskId === task.id) : [];

  // Closed state: render empty shell so the slide-out CSS transition works.
  if (!task) {
    return (
      <>
        <div className="task-drawer-overlay" aria-hidden style={{ display: "none" }} />
        <div className="task-drawer" data-testid="task-drawer" aria-hidden />
      </>
    );
  }

  return (
    <>
      {/* Overlay — closes drawer on click outside */}
      <div
        className="task-drawer-overlay"
        aria-hidden
        data-testid="task-drawer-overlay"
        onClick={onClose}
      />

      {/* Drawer panel — `open` class triggers CSS slide-in */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Task: ${task.title}`}
        className={cn("task-drawer", open && "open")}
        data-testid="task-drawer"
      >
        {/* Header: title row → breadcrumb → tabs (prototype order) */}
        <header className="td-header">
          <div className="td-header-top">
            <h2 className="td-title">{task.title}</h2>
            <button
              ref={closeRef}
              type="button"
              className="td-close"
              aria-label="Close task drawer"
              onClick={onClose}
              data-testid="task-drawer-close"
            >
              <X size={13} aria-hidden />
            </button>
          </div>

          <div className="td-breadcrumb">
            <span className="td-crumb">{instance.label}</span>
            <span className="td-crumb-sep" aria-hidden>›</span>
            <span className="td-crumb">{stageLabel}</span>
            <span className="td-crumb-sep" aria-hidden>›</span>
            <span className="td-crumb">{roleLabel}</span>
          </div>

          <div className="td-tabs" role="tablist" aria-label="Task sections">
            {(["details", "deps", "events"] as const).map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                className={cn("td-tab", activeTab === tab && "td-tab-active")}
                onClick={() => setActiveTab(tab)}
                data-testid={`td-tab-${tab === "deps" ? "dependencies" : tab}`}
              >
                {tab === "details"
                  ? "Details"
                  : tab === "deps"
                    ? "Dependencies"
                    : `Events${taskEvents.length > 0 ? ` (${taskEvents.length})` : ""}`}
              </button>
            ))}
          </div>
        </header>

        {/* Body */}
        <div className="td-body" role="tabpanel" data-testid="td-body">
          {activeTab === "details" && (
            <DetailsTab
              task={task}
              roles={roles}
              skillOptions={skillOptions}
              playbookOptions={playbookOptions}
              isPending={isPending}
              onStart={handleStart}
              onApprove={handleApprove}
              onReject={handleReject}
              onTriggersChange={handleTriggersChange}
              onGatesChange={handleGatesChange}
            />
          )}
          {activeTab === "events" && <EventsTab events={taskEvents} />}
          {activeTab === "deps" && <DependenciesTab />}
        </div>
      </div>
    </>
  );
}

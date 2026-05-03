"use client";

import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";

import {
  fetchPendingCheckpointsAction,
  resolveCheckpointAction,
} from "@/app/(dashboard)/workflows/actions";
import { captureError } from "@/lib/monitoring";
import { emitEvent } from "@/lib/events";
import { cn } from "@/lib/utils";
import type { PendingCheckpoint } from "@/lib/workflows/aggregate";

export interface CheckpointPanelProps {
  /** null = panel closed */
  open: boolean;
  onClose: () => void;
  /** Initial count so the badge renders on first paint without a round-trip. */
  initialCheckpoints?: PendingCheckpoint[];
  onPendingCountChange?: (count: number) => void;
}

export function CheckpointPanel({
  open,
  onClose,
  initialCheckpoints = [],
  onPendingCountChange,
}: CheckpointPanelProps) {
  const [checkpoints, setCheckpoints] = useState<PendingCheckpoint[]>(initialCheckpoints);
  const [loadError, setLoadError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [resolvedById, setResolvedById] = useState<Record<string, "approved" | "rejected">>({});

  // Refresh checkpoints on open.
  useEffect(() => {
    if (!open) return;
    emitEvent("dashboard.my_tasks_opened", {});
    startTransition(async () => {
      try {
        const fresh = await fetchPendingCheckpointsAction();
        setCheckpoints(fresh);
        setResolvedById({});
        onPendingCountChange?.(fresh.length);
        setLoadError(false);
      } catch (err) {
        captureError(err, { feature: "checkpoint_panel.load" });
        setLoadError(true);
      }
    });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function resolve(taskId: string, resolution: "approved" | "rejected") {
    if (isPending) return;
    startTransition(async () => {
      try {
        await resolveCheckpointAction(taskId, resolution);
        setResolvedById((prev) => {
          const next = { ...prev, [taskId]: resolution };
          onPendingCountChange?.(Math.max(0, checkpoints.length - Object.keys(next).length));
          return next;
        });
      } catch (err) {
        captureError(err, {
          feature: "checkpoint_panel.resolve",
          action: `checkpoint.${resolution}`,
          extra: { task_id: taskId },
        });
      }
    });
  }

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="cp-overlay"
          aria-hidden
          data-testid="checkpoint-panel-overlay"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-label="My Tasks"
        className={cn("cp-panel", open && "cp-panel--open")}
        data-testid="checkpoint-panel"
      >
        <header className="cp-header">
          <span className="cp-title">My Tasks</span>
          <button
            type="button"
            className="cp-close"
            aria-label="Close My Tasks panel"
            onClick={onClose}
            data-testid="checkpoint-panel-close"
          >
            <X size={13} aria-hidden />
          </button>
        </header>

        <div className="cp-body">
          {loadError && (
            <p role="alert" className="cp-error">
              Could not load tasks. Try closing and reopening.
            </p>
          )}

          {!loadError && checkpoints.length === 0 && (
            <div className="cp-empty" data-testid="checkpoint-panel-empty">
              <span className="cp-empty-icon" aria-hidden>✓</span>
              <span className="cp-empty-text">No pending tasks</span>
            </div>
          )}

          {checkpoints.length > 0 && (
            <ul className="cp-list">
              {checkpoints.map(({ task, instance, template }) => {
                const resolution = resolvedById[task.id];
                const disabled = isPending;
                return (
                  <li
                    key={task.id}
                    className="cp-item"
                    data-testid={`cp-item-${task.id}`}
                  >
                    <p className="cp-item-process" style={template ? { color: template.color } : undefined}>
                      {template?.label ?? "Workflow"} · {instance.label}
                    </p>
                    <p className="cp-item-title">{task.playbookId ?? "Task"}</p>
                    {task.notes && (
                      <p className="cp-item-desc">{task.notes}</p>
                    )}
                    <p className="cp-item-meta">
                      {new Date(task.updatedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>

                    {resolution ? (
                      <div
                        className={resolution === "approved" ? "cp-approved-badge" : "cp-rejected-badge"}
                        data-testid={`cp-resolved-${task.id}`}
                      >
                        {resolution === "approved" ? "✓ Approved" : "✗ Rejected"}
                      </div>
                    ) : (
                      <div className="cp-actions">
                        <button
                          type="button"
                          className="cp-btn cp-btn--approve"
                          disabled={disabled}
                          onClick={() => resolve(task.id, "approved")}
                          data-testid={`cp-approve-${task.id}`}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="cp-btn cp-btn--reject"
                          disabled={disabled}
                          onClick={() => resolve(task.id, "rejected")}
                          data-testid={`cp-reject-${task.id}`}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

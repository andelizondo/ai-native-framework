"use client";

import { useState, useTransition } from "react";

import { resolveCheckpointAction } from "@/app/(dashboard)/workflows/actions";
import { captureError } from "@/lib/monitoring";
import { cn } from "@/lib/utils";
import type { PendingCheckpoint } from "@/lib/workflows/aggregate";

/**
 * My Tasks card — pending checkpoint list with inline Approve / Reject.
 *
 * Visual contract: prototype `.cp-ov-item` block (`Process Canvas.html`
 * lines 396-405) and the `OverviewScreen` checkpoint markup
 * (`pc-components.jsx` line 810).
 *
 * Action wiring:
 *   - Approve  → `resolveCheckpointAction(taskId, 'approved')` (sets the
 *     task to `complete`, emits `workflow.checkpoint_approved`).
 *   - Reject   → `resolveCheckpointAction(taskId, 'rejected')` (sets the
 *     task to `blocked`, emits `workflow.checkpoint_rejected`).
 *   PR-8 (AEL-51) replaces this with a richer drawer flow including a
 *   reason note; the buttons here are the minimum write path needed to
 *   make the Overview close the loop without leaving the screen.
 */
export interface MyTasksCardProps {
  checkpoints: PendingCheckpoint[];
}

export function MyTasksCard({ checkpoints }: MyTasksCardProps) {
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function resolve(taskId: string, resolution: "approved" | "rejected") {
    // Guard against double-fires while a previous action is still in
    // flight. Without this, clicking Approve on row A then Reject on
    // row B would start a second transition; when A finished it would
    // reset `pendingId` to null and re-enable B's controls before B's
    // server action returned.
    if (isPending) return;
    setError(null);
    setPendingId(taskId);
    startTransition(async () => {
      try {
        await resolveCheckpointAction(taskId, resolution);
      } catch (err) {
        captureError(err, {
          feature: "overview.my_tasks",
          action: `checkpoint.${resolution}`,
        });
        setError(
          err instanceof Error
            ? err.message
            : "Could not resolve this checkpoint. Try again.",
        );
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <section
      data-testid="overview-my-tasks"
      className="overflow-hidden rounded-[10px] border border-border bg-bg-2"
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-[12px] font-semibold text-t1">My tasks</h2>
        {checkpoints.length > 0 && (
          <span className="rounded-full bg-primary-bg px-2 py-[1px] font-mono text-[10px] font-semibold text-accent">
            {checkpoints.length}
          </span>
        )}
      </header>

      {error && (
        <p
          role="alert"
          className="border-b border-border bg-[color:var(--pill-blocked-bg)] px-4 py-2 text-[11px] text-[color:var(--pill-blocked-t)]"
        >
          {error}
        </p>
      )}

      {checkpoints.length === 0 ? (
        <p className="px-4 py-7 text-center text-[12px] text-t2">All clear ✓</p>
      ) : (
        <ul className="divide-y divide-border-2">
          {checkpoints.map(({ task, instance, template }) => {
            // Disable every row while ANY resolve is pending so a second
            // click can't race the in-flight action; highlight the row
            // that's actually doing the work with the `…` label.
            const rowBusy = isPending && pendingId === task.id;
            const disabled = isPending;
            return (
              <li
                key={task.id}
                data-testid={`overview-my-task-${task.id}`}
                className="px-4 py-3"
              >
                <p
                  className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-t3"
                  style={template ? { color: template.color } : undefined}
                >
                  {template?.label ?? "Workflow"} · {instance.label}
                </p>
                <p className="mt-1 text-[12.5px] font-semibold text-t1">
                  {task.title}
                </p>
                {task.agent && (
                  <p className="mt-1 text-[11px] text-t3">By {task.agent}</p>
                )}
                <div className="mt-2 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => resolve(task.id, "approved")}
                    disabled={disabled}
                    data-testid={`overview-my-task-approve-${task.id}`}
                    className={cn(
                      "rounded-md bg-[color:#10b981] px-3.5 py-1.5 text-[11.5px] font-semibold text-white transition-opacity",
                      "hover:opacity-85 disabled:opacity-60",
                    )}
                  >
                    {rowBusy ? "…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => resolve(task.id, "rejected")}
                    disabled={disabled}
                    data-testid={`overview-my-task-reject-${task.id}`}
                    className={cn(
                      "rounded-md border border-border bg-bg-3 px-3.5 py-1.5 text-[11.5px] text-t2 transition-colors",
                      "hover:bg-bg-4 hover:text-t1 disabled:opacity-60",
                    )}
                  >
                    Reject
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

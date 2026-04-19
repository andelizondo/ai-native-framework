import { AlertTriangle, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TaskBarState } from "@/lib/workflows/matrix";
import type { WorkflowTask } from "@/lib/workflows/types";

/**
 * Read-only TaskCard.
 *
 * Visual contract: prototype `.task-card` block (`Process Canvas.html`
 * lines 191-218) plus the `TaskCard` JSX (`pc-components.jsx`
 * lines 310-333). Every visual concern that needs CSS keyframes,
 * pseudo-elements, or `::before` styling lives in `globals.css` under
 * the `.task-card` / `.bar-*` / `.s-*` rules — this component is just
 * the JSX harness that toggles those classes.
 *
 * The bar's accent colour is delivered via the inline `--role-color`
 * custom property (matches the prototype), so the same selector set
 * styles every role without N variants in the stylesheet. Status
 * pills reuse the canonical `pill-*` colour tokens already declared in
 * `globals.css`, so dark/light themes flip without per-state work
 * here.
 *
 * Read-only by design: this PR ships the matrix as a presentation
 * surface (per AEL-50). The task drawer / edit interactions land in
 * later slices and will likely wrap this card with their own
 * onClick / drag handlers; keeping the card a pure render keeps that
 * future split clean.
 */

const STATUS_LABEL: Record<WorkflowTask["status"], string> = {
  complete: "Complete",
  active: "In progress",
  pending_approval: "Pending approval",
  blocked: "Failed",
  not_started: "Not started",
};

const STATUS_PILL_CLASS: Record<WorkflowTask["status"], string> = {
  complete: "s-complete",
  active: "s-active",
  pending_approval: "s-pending",
  blocked: "s-blocked",
  not_started: "s-not_started",
};

export interface TaskCardProps {
  task: WorkflowTask;
  /** Hex / CSS-colour string driving the role accent bar. */
  roleColor: string;
  /** Bar-state class chosen by `barClass()`. */
  barState: TaskBarState;
  /** Opens the Task Drawer for this card. */
  onClick?: () => void;
  editMode?: boolean;
  onRemove?: () => void;
  draggable?: boolean;
  onDragStart?: React.DragEventHandler<HTMLDivElement>;
  onDragEnd?: React.DragEventHandler<HTMLDivElement>;
}

export function TaskCard({
  task,
  roleColor,
  barState,
  onClick,
  editMode = false,
  onRemove,
  draggable = false,
  onDragStart,
  onDragEnd,
}: TaskCardProps) {
  const statusClass = STATUS_PILL_CLASS[task.status];
  const statusLabel = STATUS_LABEL[task.status];

  return (
    <div
      data-testid={`task-card-${task.id}`}
      data-bar={barState}
      data-status={task.status}
      className={cn("task-card", statusClass, barState, onClick && "cursor-pointer")}
      style={{ "--role-color": roleColor } as React.CSSProperties}
      draggable={editMode && draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      aria-label={onClick ? `Open task: ${task.title}` : undefined}
    >
      {editMode ? (
        <button
          type="button"
          className="tc-remove"
          aria-label={`Remove task: ${task.title}`}
          onClick={(event) => {
            event.stopPropagation();
            onRemove?.();
          }}
        >
          <X aria-hidden size={11} strokeWidth={2.2} />
        </button>
      ) : null}
      <div className="tc-top">
        <div className="tc-title">{task.title}</div>
        {task.checkpoint && (
          <div
            className="tc-cp-badge"
            data-testid={`task-checkpoint-${task.id}`}
            aria-label="Checkpoint required"
            title="Checkpoint required"
          >
            <AlertTriangle aria-hidden size={9} strokeWidth={2.5} color="white" />
          </div>
        )}
      </div>
      {task.description ? (
        <div className="tc-desc">{task.description}</div>
      ) : null}
      <div className="tc-footer">
        <div className={cn("s-pill", statusClass)}>
          <div className="s-dot" aria-hidden />
          <div className="s-text">{statusLabel}</div>
        </div>
        {task.agent ? <div className="tc-agent">{task.agent}</div> : null}
      </div>
    </div>
  );
}

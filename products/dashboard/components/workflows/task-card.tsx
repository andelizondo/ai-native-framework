import { AlertTriangle, Pencil, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TaskBarState } from "@/lib/workflows/matrix";
import type { FrameworkItem, WorkflowTask } from "@/lib/workflows/types";

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
  /** Linked playbook resolved by the parent. `null` when the task has no
   * playbook attached or its playbook was deleted. */
  playbook?: FrameworkItem | null;
  /** Hex / CSS-colour string driving the skill row accent bar. */
  skillColor: string;
  /** Bar-state class chosen by `barClass()`. */
  barState: TaskBarState;
  /** Opens the Task Drawer for this card. */
  onClick?: () => void;
  editMode?: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
  showDefaultPill?: boolean;
}

export function TaskCard({
  task,
  playbook,
  skillColor,
  barState,
  onClick,
  editMode = false,
  onEdit,
  onRemove,
  showDefaultPill = false,
}: TaskCardProps) {
  const statusClass = STATUS_PILL_CLASS[task.status];
  const statusLabel = STATUS_LABEL[task.status];
  const showTaskActions = editMode && (Boolean(onEdit) || Boolean(onRemove));

  const title = playbook?.name ?? (task.playbookId ? "Playbook removed" : "No playbook");
  const description = playbook?.description ?? task.notes ?? "";

  return (
    <div
      data-testid={`task-card-${task.id}`}
      data-bar={barState}
      data-status={task.status}
      className={cn(
        "task-card",
        statusClass,
        barState,
        showDefaultPill && "task-card-default",
        onClick && "cursor-pointer",
      )}
      style={{ "--role-color": skillColor } as React.CSSProperties}
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
      aria-label={onClick ? `Open task: ${title}` : undefined}
    >
      <div className="tc-top">
        <div className="tc-title">{title}</div>
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
      {description ? <div className="tc-desc">{description}</div> : null}
      <div className="tc-footer">
        {showDefaultPill ? (
          <div className="s-pill rounded-full bg-bg-3">
            <div className="s-dot bg-t3" aria-hidden />
            <div className="s-text italic text-t2">default</div>
          </div>
        ) : (
          <div className={cn("s-pill", statusClass)}>
            <div className="s-dot" aria-hidden />
            <div className="s-text">{statusLabel}</div>
          </div>
        )}
        {showTaskActions ? (
          <div className="tc-actions mx-entity-actions mx-entity-actions-group">
            {onEdit ? (
              <button
                type="button"
                className="mx-entity-action"
                aria-label={`Edit task: ${title}`}
                title={`Edit ${title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit();
                }}
              >
                <Pencil aria-hidden size={11} strokeWidth={2.1} />
              </button>
            ) : null}
            {onRemove ? (
              <button
                type="button"
                className="mx-entity-action mx-entity-action-danger"
                aria-label={`Remove task: ${title}`}
                title={`Delete ${title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove();
                }}
              >
                <Trash2 aria-hidden size={11} strokeWidth={2.1} />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

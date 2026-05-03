import { AlertTriangle, Pencil, Trash2 } from "lucide-react";

import { ItemAvatar } from "@/components/framework/item-avatar";
import { cn } from "@/lib/utils";
import type { TaskBarState } from "@/lib/workflows/matrix";
import { resolveItemColor } from "@/lib/workflows/skill-colors";
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
  /** Suppress the status pill in the footer. Templates pass this since
   *  template tasks don't have a meaningful runtime status. */
  hideStatusPill?: boolean;
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
  hideStatusPill = false,
}: TaskCardProps) {
  const statusClass = STATUS_PILL_CLASS[task.status];
  const statusLabel = STATUS_LABEL[task.status];
  const showTaskActions = editMode && (Boolean(onEdit) || Boolean(onRemove));

  const title = playbook?.name ?? (task.playbookId ? "Playbook removed" : "No playbook");
  const description = playbook?.description ?? task.notes ?? "";
  const playbookColor = playbook ? resolveItemColor(playbook) : skillColor;
  const playbookEmoji = playbook?.icon ?? null;

  return (
    <div
      data-testid={`task-card-${task.id}`}
      data-bar={barState}
      data-status={task.status}
      className={cn(
        "task-card",
        statusClass,
        barState,
        hideStatusPill && "task-card-default",
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
      aria-label={onClick ? `Open playbook: ${title}` : undefined}
    >
      <div className="tc-top">
        <span className="tc-avatar-wrap" data-testid={`task-card-avatar-${task.id}`}>
          <ItemAvatar
            emoji={playbookEmoji}
            color={playbookColor}
            label={title}
            size="sm"
          />
          {task.checkpoint && (
            <span
              className="tc-cp-badge tc-cp-badge-overlay"
              data-testid={`task-checkpoint-${task.id}`}
              aria-label="Checkpoint required"
              title="Checkpoint required"
            >
              <AlertTriangle aria-hidden size={9} strokeWidth={2.5} color="white" />
            </span>
          )}
        </span>
        <div className="tc-title">{title}</div>
      </div>
      {description ? <div className="tc-desc">{description}</div> : null}
      <div className="tc-footer">
        {hideStatusPill ? (
          <span aria-hidden />
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
                aria-label={`Edit playbook: ${title}`}
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
                aria-label={`Remove playbook: ${title}`}
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

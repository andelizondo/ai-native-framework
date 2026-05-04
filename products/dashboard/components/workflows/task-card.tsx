"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CircleAlert,
  Pencil,
  StickyNote,
  Trash2,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { OwnerAvatarStack } from "@/components/framework/owner-avatar-stack";
import { cn } from "@/lib/utils";
import type { TaskBarState } from "@/lib/workflows/matrix";
import {
  TASK_STATUS_LABEL,
  TASK_STATUS_ORDER,
  TASK_STATUS_PILL_CLASS,
  TASK_STATUS_VAR,
} from "@/lib/workflows/task-status";
import type {
  FrameworkItem,
  WorkflowTask,
  WorkflowTaskStatus,
} from "@/lib/workflows/types";

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
  /** Render the card in template-editor mode: the status pill becomes a
   *  neutral "Default" badge (template tasks don't have a runtime status)
   *  and the per-task note collapses into a small icon badge with the
   *  note text revealed on hover. */
  templateView?: boolean;
  /** Called when the user picks a new status from the badge popover.
   *  Omit to render the status badge as a static pill (no popover). */
  onStatusChange?: (next: WorkflowTaskStatus) => void;
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
  templateView = false,
  onStatusChange,
}: TaskCardProps) {
  const statusClass = TASK_STATUS_PILL_CLASS[task.status];
  const statusLabel = TASK_STATUS_LABEL[task.status];

  const title = playbook?.name ?? (task.playbookId ? "Playbook removed" : "No playbook");
  const owners = task.owners ?? [];
  const showActions = editMode && (Boolean(onEdit) || Boolean(onRemove));

  return (
    <div
      data-testid={`task-card-${task.id}`}
      data-bar={barState}
      data-status={task.status}
      className={cn(
        "task-card",
        statusClass,
        barState,
        templateView && "task-card-default",
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
        <div className="tc-title">{title}</div>
      </div>
      <div className="tc-status-row">
        {templateView ? (
          <div
            className="s-pill s-default"
            data-testid={`task-status-${task.id}`}
          >
            <span className="s-text">Default</span>
          </div>
        ) : onStatusChange ? (
          <StatusBadgePopover
            status={task.status}
            onChange={onStatusChange}
            taskId={task.id}
          />
        ) : (
          <div className={cn("s-pill", statusClass)} data-testid={`task-status-${task.id}`}>
            <div className="s-text">{statusLabel}</div>
          </div>
        )}
        <div className="tc-info-badges">
          {task.notes ? (
            <InfoBadge
              tone="note"
              icon={StickyNote}
              header="Note"
              body={task.notes}
              testId={`task-note-${task.id}`}
            />
          ) : null}
          {task.checkpoint ? (
            <InfoBadge
              tone="warning"
              icon={AlertTriangle}
              header="Warning"
              body="This task requires a checkpoint approval before it can complete."
              testId={`task-checkpoint-${task.id}`}
            />
          ) : null}
          {!templateView && task.status === "blocked" ? (
            <InfoBadge
              tone="error"
              icon={CircleAlert}
              header="Error"
              body={task.substatus || "This task failed and needs attention."}
              testId={`task-error-${task.id}`}
            />
          ) : null}
        </div>
      </div>
      <div className="tc-bottom">
        <div
          className="tc-bottom-left"
          onClick={(event) => event.stopPropagation()}
        >
          {owners.length > 0 ? (
            <OwnerAvatarStack
              labels={owners}
              size="xs"
              testIdSuffix={`task-${task.id}`}
            />
          ) : (
            <EmptyOwnerAvatar taskId={task.id} />
          )}
        </div>
        {showActions ? (
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

function EmptyOwnerAvatar({ taskId }: { taskId: string }) {
  return (
    <span
      className="group/empty-owner tc-empty-owner"
      data-testid={`task-owners-empty-${taskId}`}
      role="img"
      aria-label="No owner assigned"
    >
      <UserRound aria-hidden size={12} strokeWidth={2} />
      <span role="tooltip" className="tc-empty-owner-tooltip">
        No owner assigned
      </span>
    </span>
  );
}

type InfoBadgeTone = "note" | "warning" | "error";

function InfoBadge({
  tone,
  icon: Icon,
  header,
  body,
  testId,
}: {
  tone: InfoBadgeTone;
  icon: LucideIcon;
  header: string;
  body: string;
  testId?: string;
}) {
  return (
    <span
      className={cn("group/tc-info tc-info-badge", `tc-info-badge--${tone}`)}
      data-testid={testId}
    >
      <span
        className="tc-info-badge-icon"
        role="img"
        aria-label={`${header}: ${body}`}
      >
        <Icon aria-hidden size={12} strokeWidth={2.1} />
      </span>
      <span role="tooltip" className="tc-info-badge-popover">
        <span className="tc-info-badge-popover-header">{header}</span>
        <span className="tc-info-badge-popover-body">{body}</span>
      </span>
    </span>
  );
}

function useDismissPopover(
  rootRef: React.RefObject<HTMLDivElement | null>,
  open: boolean,
  setOpen: (next: boolean) => void,
) {
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, rootRef, setOpen]);
}

function StatusBadgePopover({
  status,
  onChange,
  taskId,
}: {
  status: WorkflowTaskStatus;
  onChange: (next: WorkflowTaskStatus) => void;
  taskId: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  useDismissPopover(rootRef, open, setOpen);

  const statusClass = TASK_STATUS_PILL_CLASS[status];
  const statusLabel = TASK_STATUS_LABEL[status];

  return (
    <div ref={rootRef} className="tc-status-wrap">
      <button
        type="button"
        className={cn("s-pill tc-status-trigger", statusClass)}
        data-testid={`task-status-${taskId}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
        title="Change status"
      >
        <span className="s-text">{statusLabel}</span>
      </button>
      {open ? (
        <div
          className="tc-popover tc-popover-status"
          role="listbox"
          aria-label="Set status"
          onClick={(event) => event.stopPropagation()}
        >
          {TASK_STATUS_ORDER.map((option) => {
            const selected = option === status;
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={selected}
                className={cn("tc-popover-item", selected && "is-selected")}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                  if (!selected) onChange(option);
                }}
              >
                <span
                  className="tc-popover-dot"
                  aria-hidden
                  style={{ background: TASK_STATUS_VAR[option] }}
                />
                <span className="tc-popover-text">{TASK_STATUS_LABEL[option]}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

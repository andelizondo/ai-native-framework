"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Check,
  ChevronsDownUp,
  CircleAlert,
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
  TaskIOSummary,
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
  onRemove?: () => void;
  /** Render the card in template-editor mode: the status pill becomes a
   *  neutral "Default" badge (template tasks don't have a runtime status)
   *  and the per-task note collapses into a small icon badge with the
   *  note text revealed on hover. */
  templateView?: boolean;
  /** Called when the user picks a new status from the badge popover.
   *  Omit to render the status badge as a static pill (no popover). */
  onStatusChange?: (next: WorkflowTaskStatus) => void;
  /** Per-task IO state used to render the output pip rail and the
   *  unmet-linked-input glyph. Omit (e.g. on the template editor) to
   *  suppress both affordances. */
  ioState?: TaskIOSummary;
  /** When set, the card is currently the "promoted" sibling in a
   *  multi-card cell — render a small collapse affordance in the top
   *  corner so the user can demote it back to a compact card without
   *  opening the drawer. */
  onDemote?: () => void;
  /** Layout variant. `"full"` (default) is the 120px three-row layout.
   *  `"compact"` is the 52px one-row layout used when a cell holds
   *  multiple tasks. The root element is the same in both cases so the
   *  height / padding / flex-direction transitions animate the morph. */
  variant?: "full" | "compact";
}

export function TaskCard({
  task,
  playbook,
  skillColor,
  barState,
  onClick,
  editMode = false,
  onRemove,
  templateView = false,
  onStatusChange,
  ioState,
  onDemote,
  variant = "full",
}: TaskCardProps) {
  const statusClass = TASK_STATUS_PILL_CLASS[task.status];
  const statusLabel = TASK_STATUS_LABEL[task.status];

  const title = playbook?.name ?? (task.playbookId ? "Playbook removed" : "No playbook");
  const owners = task.owners ?? [];
  const showActions = editMode && Boolean(onRemove);
  const isCompact = variant === "compact";
  const ariaLabel = isCompact
    ? onClick
      ? `Expand playbook card: ${title}`
      : undefined
    : onClick
      ? `Open playbook: ${title}`
      : undefined;

  return (
    <div
      data-testid={`task-card-${task.id}`}
      data-bar={barState}
      data-status={task.status}
      data-variant={variant}
      className={cn(
        "task-card",
        statusClass,
        barState,
        templateView && "task-card-default",
        isCompact && "task-card-compact",
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
      aria-label={ariaLabel}
    >
      {!isCompact && onDemote ? (
        <button
          type="button"
          className="tc-demote-btn"
          aria-label={`Collapse playbook card: ${title}`}
          title="Collapse card"
          onClick={(event) => {
            event.stopPropagation();
            onDemote();
          }}
        >
          <ChevronsDownUp aria-hidden size={11} strokeWidth={2.1} />
        </button>
      ) : null}
      {isCompact ? (
        <>
          <div className="tc-compact-title" title={title}>
            {title}
          </div>
          <div
            className={cn("s-pill", statusClass, "tc-compact-status")}
            data-testid={`task-status-${task.id}`}
          >
            <span className="s-text">{statusLabel}</span>
          </div>
          {showActions && onRemove ? (
            <div className="tc-compact-actions mx-entity-actions mx-entity-actions-group">
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
            </div>
          ) : null}
        </>
      ) : (
        <FullTaskCardBody
          task={task}
          title={title}
          owners={owners}
          templateView={templateView}
          onStatusChange={onStatusChange}
          statusClass={statusClass}
          statusLabel={statusLabel}
          ioState={ioState}
          showActions={showActions}
          onRemove={onRemove}
        />
      )}
    </div>
  );
}

interface FullTaskCardBodyProps {
  task: WorkflowTask;
  title: string;
  owners: string[];
  templateView: boolean;
  onStatusChange?: (next: WorkflowTaskStatus) => void;
  statusClass: string;
  statusLabel: string;
  ioState?: TaskIOSummary;
  showActions: boolean;
  onRemove?: () => void;
}

function FullTaskCardBody({
  task,
  title,
  owners,
  templateView,
  onStatusChange,
  statusClass,
  statusLabel,
  ioState,
  showActions,
  onRemove,
}: FullTaskCardBodyProps) {
  return (
    <>
      <div className="tc-title">{title}</div>
      <div className="tc-status-row">
        <div
          className="tc-owners"
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
          {!templateView && task.status === "failed" ? (
            <InfoBadge
              tone="error"
              icon={CircleAlert}
              header="Error"
              body={task.substatus || "This task failed and needs attention."}
              testId={`task-error-${task.id}`}
            />
          ) : null}
          {!templateView && task.status === "complete" ? (
            <InfoBadge
              tone="success"
              icon={Check}
              header="Completed"
              body={formatCompletionTimestamp(task.updatedAt)}
              testId={`task-complete-${task.id}`}
            />
          ) : null}
        </div>
      </div>
      <div className="tc-bottom">
        <div
          className="tc-bottom-status"
          onClick={(event) => event.stopPropagation()}
        >
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
        </div>
        <div className="tc-bottom-right">
          <PipRail
            outputs={ioState?.outputs ?? []}
            testIdPrefix={`task-pip-${task.id}`}
            railTestId={`task-pip-rail-${task.id}`}
          />
          {showActions && onRemove ? (
            <div className="tc-actions mx-entity-actions mx-entity-actions-group">
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
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

export interface PipRailOutput {
  id: string;
  name: string;
  position: number;
  status: string;
}

export function PipRail({
  outputs,
  testIdPrefix,
  railTestId,
}: {
  outputs: readonly PipRailOutput[];
  testIdPrefix?: string;
  railTestId?: string;
}) {
  if (outputs.length === 0) {
    return <span className="tc-pip-rail tc-pip-rail-empty" aria-hidden />;
  }
  return (
    <span
      className="tc-pip-rail"
      role="list"
      aria-label="Outputs progress"
      data-testid={railTestId}
    >
      {outputs.map((output) => (
        <span
          key={output.id}
          role="listitem"
          className="group/tc-pip tc-pip"
          data-status={output.status}
          data-testid={testIdPrefix ? `${testIdPrefix}-${output.id}` : undefined}
          aria-label={`Output ${output.position + 1}: ${output.name} (${output.status})`}
        >
          <span role="tooltip" className="tc-pip-tooltip">
            {output.name}
          </span>
        </span>
      ))}
    </span>
  );
}

export function EmptyOwnerAvatar({ taskId }: { taskId: string }) {
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

type InfoBadgeTone = "note" | "warning" | "error" | "success";

function formatCompletionTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Completion time unavailable";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function InfoBadge({
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

/**
 * Closes the popover when the user clicks outside any of the given refs
 * (trigger wrapper + portaled popover panel). Accepting a list of refs is
 * what makes portaled popovers work — a single ref would dismiss on every
 * click in the panel since the panel lives outside the React tree.
 */
function useDismissPopover(
  refs: React.RefObject<HTMLElement | null>[],
  open: boolean,
  setOpen: (next: boolean) => void,
) {
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      for (const ref of refs) {
        if (ref.current?.contains(target)) return;
      }
      setOpen(false);
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
  }, [open, refs, setOpen]);
}

export function StatusBadgePopover({
  status,
  onChange,
  taskId,
  triggerClassName,
  triggerContent,
  triggerProps,
}: {
  status: WorkflowTaskStatus;
  onChange: (next: WorkflowTaskStatus) => void;
  taskId: string;
  /** Override the trigger button's class list. Defaults to the matrix
   * card's pill styling; the drawer passes its own `pb-drawer-status-pill`
   * class so the popover blends with the drawer header.
   */
  triggerClassName?: string;
  /** Optional override for the trigger's children. Defaults to the
   * status label text.
   */
  triggerContent?: React.ReactNode;
  /** Extra attributes for the trigger button — e.g. a custom `data-testid`
   * or `data-status` for callers that need to assert against them. The
   * default `task-status-${taskId}` testid is preserved if not overridden.
   */
  triggerProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  useDismissPopover(useMemo(() => [rootRef, popoverRef], []), open, setOpen);

  const statusClass = TASK_STATUS_PILL_CLASS[status];
  const statusLabel = TASK_STATUS_LABEL[status];

  // Position the portaled popover above the trigger using viewport coords.
  // The trigger's position is captured once on open and on scroll/resize so
  // the popover follows when the matrix scrolls underneath it. Falls back
  // to opening *below* the trigger when there isn't enough headroom — the
  // drawer header sits right against the top of the viewport, and the
  // status chip there had nowhere to render.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return undefined;
    }
    function measure() {
      const trigger = triggerRef.current;
      const popover = popoverRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const popoverHeight = popover?.getBoundingClientRect().height ?? 220;
      const gap = 6;
      const topAbove = rect.top - popoverHeight - gap;
      const overflowsTop = topAbove < gap;
      const top = overflowsTop ? rect.bottom + gap : topAbove;
      setPosition({ left: rect.left, top });
    }
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  const popoverNode =
    open && typeof document !== "undefined" ? (
      <div
        ref={popoverRef}
        className="tc-popover tc-popover-status"
        role="listbox"
        aria-label="Set status"
        onClick={(event) => event.stopPropagation()}
        style={
          position
            ? {
                position: "fixed",
                left: position.left,
                top: position.top,
                bottom: "auto",
              }
            : { position: "fixed", visibility: "hidden" }
        }
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
    ) : null;

  return (
    <div ref={rootRef} className="tc-status-wrap">
      <button
        ref={triggerRef}
        type="button"
        data-testid={`task-status-${taskId}`}
        {...triggerProps}
        className={triggerClassName ?? cn("s-pill tc-status-trigger", statusClass)}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
        title="Change status"
      >
        {triggerContent ?? <span className="s-text">{statusLabel}</span>}
      </button>
      {popoverNode ? createPortal(popoverNode, document.body) : null}
    </div>
  );
}

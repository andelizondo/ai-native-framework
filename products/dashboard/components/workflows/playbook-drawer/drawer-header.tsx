"use client";

import type { ButtonHTMLAttributes } from "react";
import { MoreVertical, X } from "lucide-react";

import { OwnerAvatarStack } from "@/components/framework/owner-avatar-stack";
import { StatusBadgePopover } from "@/components/workflows/task-card";
import { cn } from "@/lib/utils";
import {
  TASK_STATUS_LABEL,
  TASK_STATUS_PILL_CLASS,
} from "@/lib/workflows/task-status";
import type {
  FrameworkItem,
  WorkflowInstanceDetail,
  WorkflowSkill,
  WorkflowTask,
  WorkflowTaskStatus,
} from "@/lib/workflows/types";

export type HeaderBarVariant = "active" | "pending" | "blocked" | null;

const STATUS_BAR_VARIANT: Record<WorkflowTaskStatus, HeaderBarVariant> = {
  not_started: null,
  waiting: "pending",
  paused: "blocked",
  in_progress: "active",
  running: "active",
  complete: null,
  failed: "blocked",
};

export interface DrawerHeaderProps {
  task: WorkflowTask;
  instance: WorkflowInstanceDetail;
  skills: WorkflowSkill[];
  playbookOptions: FrameworkItem[];
  onClose: () => void;
  onStatusChange?: (next: WorkflowTaskStatus) => void;
}

export function DrawerHeader({
  task,
  instance,
  skills,
  playbookOptions,
  onClose,
  onStatusChange,
}: DrawerHeaderProps) {
  const skill = skills.find((s) => s.id === task.skillId);
  const playbook = task.playbookId
    ? playbookOptions.find((p) => p.id === task.playbookId)
    : null;
  const stage = instance.stages.find((s) => s.id === task.stageId);

  const title = playbook?.name ?? (task.playbookId ? "Playbook removed" : "Playbook");
  const description = playbook?.description?.trim() ?? "";
  const roleColor = playbook?.color ?? "#6366f1";
  const barVariant = STATUS_BAR_VARIANT[task.status];

  return (
    <header
      className={cn(
        "pb-drawer-context",
        barVariant && `pb-drawer-context--bar-${barVariant}`,
      )}
      style={{ "--role-color": roleColor } as React.CSSProperties}
      data-testid="pb-drawer-header"
      data-bar-variant={barVariant ?? "none"}
    >
      <div className="pb-drawer-context__inner">
        <div className="pb-drawer-context__top">
          <div className="pb-drawer-context__icon" aria-hidden>
            {playbook?.icon ?? "📋"}
          </div>
          <div className="pb-drawer-context__title-block">
            <h2 className="pb-drawer-context__title">{title}</h2>
            {description ? (
              <p className="pb-drawer-context__desc">{description}</p>
            ) : null}
            <div className="pb-drawer-context__crumbs">
              <span>{instance.label}</span>
              <span className="pb-drawer-context__crumb-sep" aria-hidden>›</span>
              <span>{stage?.label ?? task.stageId}</span>
              <span className="pb-drawer-context__crumb-sep" aria-hidden>›</span>
              <span>{skill?.label ?? task.skillId}</span>
            </div>
          </div>
          <div className="pb-drawer-context__actions">
            <button
              type="button"
              className="pb-drawer-context__icon-btn"
              aria-label="More"
              title="More"
            >
              <MoreVertical size={14} aria-hidden />
            </button>
            <button
              type="button"
              className="pb-drawer-context__icon-btn"
              aria-label="Close playbook drawer"
              title="Close"
              onClick={onClose}
              data-testid="pb-drawer-close"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        </div>
      </div>
      <div className="pb-drawer-context__footer">
        {onStatusChange ? (
          <StatusBadgePopover
            status={task.status}
            taskId={`pb-drawer-${task.id}`}
            onChange={onStatusChange}
            triggerClassName={cn(
              "pb-drawer-status-pill",
              TASK_STATUS_PILL_CLASS[task.status],
            )}
            triggerContent={
              <>
                <span className="pb-drawer-status-pill__dot" aria-hidden />
                {TASK_STATUS_LABEL[task.status]}
              </>
            }
            triggerProps={
              {
                "data-testid": "pb-drawer-status-pill",
                "data-status": task.status,
              } as ButtonHTMLAttributes<HTMLButtonElement>
            }
          />
        ) : (
          <span
            className={cn(
              "pb-drawer-status-pill",
              TASK_STATUS_PILL_CLASS[task.status],
            )}
            data-status={task.status}
            data-testid="pb-drawer-status-pill"
          >
            <span className="pb-drawer-status-pill__dot" aria-hidden />
            {TASK_STATUS_LABEL[task.status]}
          </span>
        )}
        <div className="pb-drawer-context__owners" data-testid="pb-drawer-owners">
          <span className="pb-drawer-context__owners-lbl">Owners</span>
          <OwnerAvatarStack labels={task.owners} size="xs" testIdSuffix="pb-drawer" />
        </div>
      </div>
    </header>
  );
}

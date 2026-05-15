"use client";

import type { ButtonHTMLAttributes } from "react";

import {
  PipRail,
  StatusBadgePopover,
  type PipRailOutput,
} from "@/components/workflows/task-card";
import { cn } from "@/lib/utils";
import {
  TASK_STATUS_LABEL,
  TASK_STATUS_PILL_CLASS,
} from "@/lib/workflows/task-status";
import type { WorkflowTaskStatus } from "@/lib/workflows/types";

export interface StatusSectionProps {
  taskId: string;
  status: WorkflowTaskStatus;
  outputs: readonly PipRailOutput[];
  busy: boolean;
  onStatusChange: (next: WorkflowTaskStatus) => void;
}

export function StatusSection({
  taskId,
  status,
  outputs,
  busy,
  onStatusChange,
}: StatusSectionProps) {
  return (
    <div className="pb-drawer-status-section" data-testid="pb-drawer-status-section">
      <StatusBadgePopover
        status={status}
        taskId={`pb-drawer-${taskId}`}
        onChange={onStatusChange}
        triggerClassName={cn(
          "pb-drawer-status-pill",
          TASK_STATUS_PILL_CLASS[status],
        )}
        triggerContent={
          <>
            <span className="pb-drawer-status-pill__dot" aria-hidden />
            {TASK_STATUS_LABEL[status]}
          </>
        }
        triggerProps={
          {
            "data-testid": "pb-drawer-status-pill",
            "data-status": status,
            disabled: busy,
          } as ButtonHTMLAttributes<HTMLButtonElement>
        }
      />
      <PipRail
        outputs={outputs}
        testIdPrefix={`pb-drawer-pip-${taskId}`}
        railTestId={`pb-drawer-pip-rail-${taskId}`}
      />
    </div>
  );
}

"use client";

import { AlertTriangle, Check, CircleAlert, StickyNote } from "lucide-react";

import { OwnerPicker } from "@/components/framework/owner-picker";
import {
  EmptyOwnerAvatar,
  InfoBadge,
} from "@/components/workflows/task-card";
import type { WorkflowTask } from "@/lib/workflows/types";

export interface ActionBarProps {
  task: WorkflowTask;
  busy: boolean;
  onOwnersChange?: (next: string[]) => void;
}

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

export function ActionBar({ task, busy, onOwnersChange }: ActionBarProps) {
  const owners = task.owners ?? [];

  return (
    <div className="pb-drawer-actionbar" data-testid="pb-drawer-actionbar">
      <div className="pb-drawer-actionbar__owners" data-testid="pb-drawer-owners">
        {onOwnersChange ? (
          <OwnerPicker
            values={owners}
            onChange={onOwnersChange}
            variant="stack"
            required={false}
            stackAvatarSize="xs"
            stackEmptyLabel
            testIdSuffix="pb-drawer"
          />
        ) : owners.length > 0 ? (
          <span className="pb-drawer-actionbar__owners-readonly">
            {owners.join(", ")}
          </span>
        ) : (
          <EmptyOwnerAvatar taskId={`pb-drawer-${task.id}`} />
        )}
      </div>
      <div className="pb-drawer-actionbar__info" data-testid="pb-drawer-info-badges">
        {task.notes ? (
          <InfoBadge
            tone="note"
            icon={StickyNote}
            header="Note"
            body={task.notes}
            testId={`pb-drawer-note-${task.id}`}
          />
        ) : null}
        {task.checkpoint ? (
          <InfoBadge
            tone="warning"
            icon={AlertTriangle}
            header="Warning"
            body="This task requires a checkpoint approval before it can complete."
            testId={`pb-drawer-checkpoint-${task.id}`}
          />
        ) : null}
        {task.status === "failed" ? (
          <InfoBadge
            tone="error"
            icon={CircleAlert}
            header="Error"
            body={task.substatus || "This task failed and needs attention."}
            testId={`pb-drawer-error-${task.id}`}
          />
        ) : null}
        {task.status === "complete" ? (
          <InfoBadge
            tone="success"
            icon={Check}
            header="Completed"
            body={formatCompletionTimestamp(task.updatedAt)}
            testId={`pb-drawer-complete-${task.id}`}
          />
        ) : null}
      </div>
      {/* `busy` reserved for future skeleton state — keep referenced so
       *  callers don't need to drop the prop. */}
      <span hidden aria-hidden data-busy={busy} />
    </div>
  );
}

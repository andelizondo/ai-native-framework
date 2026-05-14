"use client";

import { BookOpen, History, Pause, Play, RotateCw } from "lucide-react";

import { cn } from "@/lib/utils";
import type { WorkflowTaskStatus } from "@/lib/workflows/types";

export interface ActionBarProps {
  status: WorkflowTaskStatus;
  hasUnmetInputs: boolean;
  busy: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onRetry: () => void;
  onOpenPlaybook?: () => void;
  onToggleHistory: () => void;
}

export function ActionBar({
  status,
  hasUnmetInputs,
  busy,
  onStart,
  onPause,
  onResume,
  onRetry,
  onOpenPlaybook,
  onToggleHistory,
}: ActionBarProps) {
  const showStart = status === "not_started" || status === "waiting";
  const startDisabled = status === "waiting" || hasUnmetInputs || busy;
  const startLabel = status === "waiting" ? "Start (waiting on inputs)" : "Start playbook";
  const showPause = status === "in_progress" || status === "running";
  const showResume = status === "paused";
  const showRetry = status === "failed";

  return (
    <div className="pb-drawer-actionbar" data-testid="pb-drawer-actionbar">
      {showStart ? (
        <button
          type="button"
          className={cn(
            "pb-drawer-actionbar__btn",
            "pb-drawer-actionbar__btn--primary",
            startDisabled && "pb-drawer-actionbar__btn--disabled",
          )}
          onClick={onStart}
          disabled={startDisabled}
          data-testid="pb-drawer-start-btn"
        >
          <Play size={11} aria-hidden fill="currentColor" stroke="none" />
          <span>{startLabel}</span>
        </button>
      ) : null}

      {showResume ? (
        <button
          type="button"
          className={cn(
            "pb-drawer-actionbar__btn",
            "pb-drawer-actionbar__btn--primary",
          )}
          onClick={onResume}
          disabled={busy}
          data-testid="pb-drawer-resume-btn"
        >
          <Play size={11} aria-hidden fill="currentColor" stroke="none" />
          <span>Resume</span>
        </button>
      ) : null}

      {showRetry ? (
        <button
          type="button"
          className={cn(
            "pb-drawer-actionbar__btn",
            "pb-drawer-actionbar__btn--primary",
          )}
          onClick={onRetry}
          disabled={busy}
          data-testid="pb-drawer-retry-btn"
        >
          <RotateCw size={11} aria-hidden />
          <span>Retry</span>
        </button>
      ) : null}

      {onOpenPlaybook ? (
        <button
          type="button"
          className="pb-drawer-actionbar__btn"
          onClick={onOpenPlaybook}
          data-testid="pb-drawer-open-playbook-btn"
        >
          <BookOpen size={11} aria-hidden />
          <span>Open playbook</span>
        </button>
      ) : null}

      <button
        type="button"
        className="pb-drawer-actionbar__btn"
        onClick={onToggleHistory}
        data-testid="pb-drawer-history-btn"
      >
        <History size={11} aria-hidden />
        <span>History</span>
      </button>

      <div className="pb-drawer-actionbar__spacer" />

      {showPause ? (
        <button
          type="button"
          className="pb-drawer-actionbar__btn"
          onClick={onPause}
          disabled={busy}
          data-testid="pb-drawer-pause-btn"
        >
          <Pause size={11} aria-hidden />
          <span>Pause</span>
        </button>
      ) : null}
    </div>
  );
}

"use client";

import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type IORowKind = "input" | "output";
export type IORowChip = "linked" | "manual" | "bypass" | "file" | "media" | "link" | "api";
export type IORowState = "received" | "pending" | "failed" | "bypass";

export interface IORowProps {
  kind: IORowKind;
  name: string;
  chip: IORowChip;
  chipLabel: string;
  state: IORowState;
  /** Optional source label shown under unmet inputs (e.g. upstream task name). */
  sourceLabel?: string;
  dimmed?: boolean;
  onAction?: () => void;
  testId?: string;
}

const ACTION_LABEL: Record<IORowKind, Record<IORowState, string | null>> = {
  input: {
    received: null,
    pending: "Mark received",
    failed: "Retry",
    bypass: "Bypassed",
  },
  output: {
    received: "View",
    pending: "Attach",
    failed: "Retry",
    bypass: "Skipped",
  },
};

export function IORow({
  kind,
  name,
  chip,
  chipLabel,
  state,
  sourceLabel,
  dimmed = false,
  onAction,
  testId,
}: IORowProps) {
  const checkClass =
    state === "received"
      ? "checked"
      : state === "failed"
        ? "failed"
        : state === "bypass"
          ? "bypass"
          : "";
  const actionLabel = ACTION_LABEL[kind][state];
  const isReceived = state === "received";

  return (
    <div
      className={cn("pb-drawer-io-row", dimmed && "pb-drawer-io-row--dimmed")}
      data-testid={testId}
      data-kind={kind}
      data-state={state}
    >
      <div className={cn("pb-drawer-io-check", checkClass && `pb-drawer-io-check--${checkClass}`)}>
        {state === "received" ? (
          <Check size={11} strokeWidth={2.5} aria-hidden />
        ) : state === "failed" ? (
          <X size={10} strokeWidth={2.5} aria-hidden />
        ) : null}
      </div>
      <div className="pb-drawer-io-main">
        <div
          className={cn(
            "pb-drawer-io-name",
            isReceived && kind === "input" && "pb-drawer-io-name--checked",
            isReceived && kind === "output" && "pb-drawer-io-name--checked",
          )}
        >
          {name}
        </div>
        {sourceLabel ? (
          <div className="pb-drawer-io-source">⤴ from <span>{sourceLabel}</span></div>
        ) : null}
      </div>
      <div className="pb-drawer-io-meta">
        <span className={cn("pb-drawer-io-chip", `pb-drawer-io-chip--${chip}`)}>{chipLabel}</span>
        {actionLabel && onAction ? (
          <button
            type="button"
            className="pb-drawer-io-action"
            onClick={onAction}
            data-testid={testId ? `${testId}-action` : undefined}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { Check, X } from "lucide-react";

import { ItemAvatar } from "@/components/framework/item-avatar";
import { cn } from "@/lib/utils";

export type IORowKind = "input" | "output";
export type IORowState = "received" | "pending" | "failed" | "bypass";

export interface IORowAvatar {
  emoji?: string | null;
  color: string;
  label: string;
}

export interface IORowProps {
  kind: IORowKind;
  /** Bold top-line label. For linked inputs this is the upstream playbook
   *  name; for outputs and unlinked inputs this is the I/O name itself. */
  primaryLabel: string;
  /** Optional second line (e.g. the upstream output name on linked inputs,
   *  the description on outputs). */
  secondaryLabel?: string;
  /** Avatar for the upstream playbook (linked inputs) or output kind (outputs). */
  avatar?: IORowAvatar;
  state: IORowState;
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
  primaryLabel,
  secondaryLabel,
  avatar,
  state,
  dimmed = false,
  onAction,
  testId,
}: IORowProps) {
  const actionLabel = ACTION_LABEL[kind][state];
  const isReceived = state === "received";
  const isFailed = state === "failed";

  return (
    <div
      className={cn("pb-drawer-io-row", dimmed && "pb-drawer-io-row--dimmed")}
      data-testid={testId}
      data-kind={kind}
      data-state={state}
    >
      {avatar ? (
        <ItemAvatar
          emoji={avatar.emoji}
          color={avatar.color}
          label={avatar.label}
          size="sm"
        />
      ) : (
        <div
          className={cn(
            "pb-drawer-io-check",
            isReceived && "pb-drawer-io-check--checked",
            isFailed && "pb-drawer-io-check--failed",
            state === "bypass" && "pb-drawer-io-check--bypass",
          )}
          aria-hidden
        >
          {isReceived ? (
            <Check size={11} strokeWidth={2.5} />
          ) : isFailed ? (
            <X size={10} strokeWidth={2.5} />
          ) : null}
        </div>
      )}
      <div className="pb-drawer-io-main">
        <div
          className={cn(
            "pb-drawer-io-name",
            isReceived && "pb-drawer-io-name--checked",
          )}
        >
          {primaryLabel}
        </div>
        {secondaryLabel ? (
          <div className="pb-drawer-io-sub">{secondaryLabel}</div>
        ) : null}
      </div>
      <div className="pb-drawer-io-meta">
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

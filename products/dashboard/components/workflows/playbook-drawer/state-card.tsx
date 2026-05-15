"use client";

import { CircleAlert, Clock, Pause, Play } from "lucide-react";

import { cn } from "@/lib/utils";

export type StateCardKind = "not_started" | "waiting" | "paused" | "failed";

export interface StateCardAction {
  label: string;
  primary?: boolean;
  onClick?: () => void;
  testId?: string;
}

export interface StateCardProps {
  kind: StateCardKind;
  title: string;
  body: string;
  actions?: StateCardAction[];
}

export function StateCard({ kind, title, body, actions = [] }: StateCardProps) {
  const Icon =
    kind === "not_started"
      ? Play
      : kind === "waiting"
        ? Clock
        : kind === "paused"
          ? Pause
          : CircleAlert;

  return (
    <div
      className={cn("pb-drawer-state-card", `pb-drawer-state-card--${kind}`)}
      data-testid="pb-drawer-state-card"
      data-kind={kind}
    >
      <div className="pb-drawer-state-card__head">
        <Icon size={14} aria-hidden />
        <span>{title}</span>
      </div>
      <div className="pb-drawer-state-card__body">{body}</div>
      {actions.length > 0 ? (
        <div className="pb-drawer-state-card__actions">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={cn(
                "pb-drawer-state-card__btn",
                action.primary && "pb-drawer-state-card__btn--primary",
              )}
              onClick={action.onClick}
              data-testid={action.testId}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

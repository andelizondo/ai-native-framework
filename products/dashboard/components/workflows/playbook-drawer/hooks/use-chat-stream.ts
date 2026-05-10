"use client";

import { useMemo } from "react";

import type { WorkflowEvent, WorkflowTaskStatus } from "@/lib/workflows/types";

export type ChatStreamMode = "idle" | "streaming" | "awaiting_user" | "complete";

export interface ChatTraceEntry {
  id: string;
  kind: "done" | "tool";
  body: string;
  emphasis?: string;
}

export interface UseChatStreamResult {
  events: WorkflowEvent[];
  trace: ChatTraceEntry[];
  currentSummary: string | null;
  mode: ChatStreamMode;
}

/**
 * Stub implementation of the agent chat stream. Real streaming will read
 * from an `agent_runs` table that does not yet exist (the AEL-58 PR series
 * stops short of the runtime). For now we project recent task-scoped
 * `WorkflowEvent`s into the trace UI so the drawer's activity strip and
 * transcript both have content.
 *
 * TODO(AEL-61 follow-up): wire to real agent runtime once `agent_runs`
 * lands. Mode derivation should switch to reading `agent_runs.status`
 * instead of inferring from task status.
 */
export function useChatStream(
  status: WorkflowTaskStatus,
  events: WorkflowEvent[],
): UseChatStreamResult {
  const mode: ChatStreamMode = useMemo(() => {
    if (status === "running") return "streaming";
    if (status === "complete" || status === "failed") return "complete";
    if (status === "paused") return "awaiting_user";
    return "idle";
  }, [status]);

  const trace = useMemo<ChatTraceEntry[]>(() => {
    return events.slice(-8).map((event) => ({
      id: event.id,
      kind: event.name.endsWith(".failed") ? "tool" : "done",
      body: event.description || event.name,
      emphasis: event.name.split(".").pop()?.replace(/_/g, " "),
    }));
  }, [events]);

  const currentSummary = useMemo(() => {
    if (mode !== "streaming") return null;
    const last = events[events.length - 1];
    return last?.description ?? "Working…";
  }, [mode, events]);

  return { events, trace, currentSummary, mode };
}

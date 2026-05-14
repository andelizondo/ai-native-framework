"use client";

import { useRef, useState } from "react";
import { ChevronUp, Paperclip, Send } from "lucide-react";

import { cn } from "@/lib/utils";
import type { WorkflowEvent, WorkflowTaskStatus } from "@/lib/workflows/types";

import { RefineCard } from "./refine-card";
import { useChatStream } from "./hooks/use-chat-stream";

const MODEL_OPTIONS = ["Sonnet 4.6", "Opus 4.7", "Haiku 4.5"] as const;
type Model = (typeof MODEL_OPTIONS)[number];

const RUN_INTENT = /\b(run( this)?|start)\b/i;

export interface ChatFooterProps {
  status: WorkflowTaskStatus;
  events: WorkflowEvent[];
  busy: boolean;
  onStart: () => void;
  onRefine: () => void;
}

const PLACEHOLDER: Record<WorkflowTaskStatus, string> = {
  not_started: 'Ask for help, or type "run this" to start the agent…',
  waiting: "Ask about what's missing, or about this playbook…",
  paused: "Ask about the pause, or message the team…",
  in_progress: "Ask the agent to do a step, or message the team…",
  running: 'Add context, or interrupt with "stop"…',
  complete: "Ask anything about this run…",
  failed: "Ask what went wrong, or fix and retry…",
};

export function ChatFooter({
  status,
  events,
  busy,
  onStart,
  onRefine,
}: ChatFooterProps) {
  const { trace, currentSummary, mode } = useChatStream(status, events);
  const [model, setModel] = useState<Model>("Sonnet 4.6");
  const [draft, setDraft] = useState("");
  const [showTrace, setShowTrace] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const showActivity = mode === "streaming";
  const showRefine = status === "complete";

  function handleSend() {
    const text = draft.trim();
    if (!text) return;
    if (status === "not_started" && RUN_INTENT.test(text)) {
      onStart();
      setDraft("");
      return;
    }
    // No chat backend yet (AEL-61 follow-up). Surface clearly.
    if (process.env.NODE_ENV !== "test") {
      // eslint-disable-next-line no-console
      console.info(
        "[playbook-drawer] chat send is stubbed (AEL-61 follow-up)",
        { model, text },
      );
    }
    setDraft("");
  }

  function handleTextareaInput(event: React.FormEvent<HTMLTextAreaElement>) {
    const el = event.currentTarget;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    setDraft(el.value);
  }

  return (
    <div className="pb-drawer-chat" data-testid="pb-drawer-chat">
      {showActivity ? (
        <button
          type="button"
          className="pb-drawer-activity"
          onClick={() => setShowTrace((v) => !v)}
          data-testid="pb-drawer-activity-strip"
        >
          <div className="pb-drawer-activity__spin" aria-hidden />
          <div className="pb-drawer-activity__text">
            {currentSummary ?? "Working…"}
          </div>
          <span className="pb-drawer-activity__toggle">
            <ChevronUp
              size={11}
              className={cn(
                "pb-drawer-activity__chev",
                showTrace && "pb-drawer-activity__chev--open",
              )}
              aria-hidden
            />
            {showTrace ? "Hide trace" : "Show trace"}
          </span>
        </button>
      ) : null}

      {showActivity && showTrace ? (
        <div className="pb-drawer-transcript" data-testid="pb-drawer-transcript">
          {trace.length === 0 ? (
            <div className="pb-drawer-transcript__empty">No trace yet.</div>
          ) : (
            trace.map((entry) => (
              <div className="pb-drawer-trace" key={entry.id}>
                <div
                  className={cn(
                    "pb-drawer-trace__icon",
                    `pb-drawer-trace__icon--${entry.kind}`,
                  )}
                  aria-hidden
                >
                  {entry.kind === "done" ? "✓" : "⚙"}
                </div>
                <div className="pb-drawer-trace__body">
                  {entry.emphasis ? <strong>{entry.emphasis}</strong> : null}
                  {entry.body}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      <div
        className={cn(
          "pb-drawer-chat-input-wrap",
          showRefine && "pb-drawer-chat-input-wrap--complete",
        )}
      >
        {showRefine ? <RefineCard onRefine={onRefine} disabled={busy} /> : null}

        <div className="pb-drawer-input-box">
          <textarea
            ref={textareaRef}
            className="pb-drawer-input-textarea"
            placeholder={PLACEHOLDER[status]}
            rows={1}
            value={draft}
            onInput={handleTextareaInput}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            data-testid="pb-drawer-chat-textarea"
          />
          <div className="pb-drawer-input-toolbar">
            <select
              className="pb-drawer-model-select"
              value={model}
              onChange={(e) => setModel(e.target.value as Model)}
              aria-label="Model"
              data-testid="pb-drawer-model-select"
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="pb-drawer-input-attach"
              aria-label="Attach file"
              title="Attach file"
            >
              <Paperclip size={13} aria-hidden />
            </button>
            <div className="pb-drawer-input-spacer" />
            <button
              type="button"
              className="pb-drawer-input-send"
              aria-label="Send"
              title="Send"
              onClick={handleSend}
              disabled={!draft.trim()}
              data-testid="pb-drawer-send-btn"
            >
              <Send size={13} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

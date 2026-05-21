"use client";

import { useRef, useState } from "react";
import { ChevronUp, Paperclip, Send, Square } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  PlaybookOutput,
  WorkflowEvent,
  WorkflowTask,
} from "@/lib/workflows/types";

import { ChatActionPanel } from "./chat-action-panel";
import { useChatStream } from "./hooks/use-chat-stream";

const MODEL_OPTIONS = ["Sonnet 4.6", "Opus 4.7", "Haiku 4.5"] as const;
type Model = (typeof MODEL_OPTIONS)[number];

const RUN_INTENT = /\b(run( this)?|start)\b/i;

export interface ChatFooterProps {
  task: WorkflowTask;
  events: WorkflowEvent[];
  busy: boolean;
  hasUnmetInputs: boolean;
  pendingOutputs: PlaybookOutput[];
  hasOutputs: boolean;
  onStart: () => void;
  onResume: () => void;
  onRetry: () => void;
  onRefine: () => void;
  onStop: () => void;
  onProduceOutput: (outputId: string) => void;
  onCompleteTask: () => void;
}

const PLACEHOLDER: Record<WorkflowTask["status"], string> = {
  not_started: 'Type here to clarify, or "run this" to start…',
  waiting: "Type here what's blocking, or what you need…",
  paused: "Type here what changed, or why to keep going…",
  in_progress: "Type here what step to take next…",
  running: 'Type here to add context, or "stop" to interrupt…',
  complete: "Type here what to capture about this run…",
  failed: "Type here what went wrong, or how to fix it…",
};

export function ChatFooter({
  task,
  events,
  busy,
  hasUnmetInputs,
  pendingOutputs,
  hasOutputs,
  onStart,
  onResume,
  onRetry,
  onRefine,
  onStop,
  onProduceOutput,
  onCompleteTask,
}: ChatFooterProps) {
  const status = task.status;
  const { trace, currentSummary, mode } = useChatStream(status, events);
  const [model, setModel] = useState<Model>("Sonnet 4.6");
  const [draft, setDraft] = useState("");
  const [showTrace, setShowTrace] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const showActivity = mode === "streaming";

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
        <div className="pb-drawer-activity-row">
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
          <button
            type="button"
            className="pb-drawer-activity-stop"
            onClick={onStop}
            disabled={busy}
            data-testid="pb-drawer-stop-btn"
            aria-label="Stop"
            title="Stop"
          >
            <Square size={11} aria-hidden />
            Stop
          </button>
        </div>
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

      <div className="pb-drawer-chat-input-wrap">
        {!showActivity ? (
          <ChatActionPanel
            task={task}
            hasUnmetInputs={hasUnmetInputs}
            pendingOutputs={pendingOutputs}
            hasOutputs={hasOutputs}
            busy={busy}
            onStart={onStart}
            onResume={onResume}
            onRetry={onRetry}
            onRefine={onRefine}
            onProduceOutput={onProduceOutput}
            onCompleteTask={onCompleteTask}
          />
        ) : null}

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

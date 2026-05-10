"use client";

import { useState } from "react";
import { ChevronRight, MessageSquare } from "lucide-react";

import { cn } from "@/lib/utils";
import type { WorkflowEvent } from "@/lib/workflows/types";

export interface CommentsSectionProps {
  events: WorkflowEvent[];
}

/**
 * Comments are not yet a first-class concept in the schema (no `comments`
 * table). This section reads `workflow.task_commented` events as a proxy
 * so the drawer is at structural parity with the design. The composer is
 * a no-op stub.
 *
 * TODO(AEL-61 follow-up): wire to a real comments backend (likely a new
 * `task_comments` table + actions). Until then the input dispatches a
 * console message so the missing wire is loud.
 */
export function CommentsSection({ events }: CommentsSectionProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const comments = events.filter((e) => e.name === "workflow.task_commented");

  return (
    <section className="pb-drawer-sec" data-testid="pb-drawer-comments-section">
      <div className="pb-drawer-sec__lbl">Comments</div>
      <div className={cn("pb-drawer-comments", open && "pb-drawer-comments--open")}>
        <button
          type="button"
          className="pb-drawer-collapse-toggle"
          onClick={() => setOpen((v) => !v)}
          data-testid="pb-drawer-comments-toggle"
        >
          <span className="pb-drawer-collapse-toggle__left">
            <MessageSquare size={13} aria-hidden />
            <span>
              <strong>{comments.length} comments</strong>
            </span>
          </span>
          <ChevronRight
            size={14}
            className="pb-drawer-collapse-toggle__chev"
            aria-hidden
          />
        </button>
        {open ? (
          <div className="pb-drawer-comments__list">
            {comments.length === 0 ? (
              <div className="pb-drawer-comments__empty">
                No comments yet.
              </div>
            ) : (
              comments.map((event) => (
                <div className="pb-drawer-comment" key={event.id}>
                  <div className="pb-drawer-comment__av">
                    {(event.payload?.author as string | undefined)
                      ?.slice(0, 2)
                      .toUpperCase() ?? "··"}
                  </div>
                  <div className="pb-drawer-comment__body">
                    <div className="pb-drawer-comment__meta">
                      <strong>{(event.payload?.author as string | undefined) ?? "Unknown"}</strong>
                      <span>{new Date(event.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="pb-drawer-comment__text">
                      {event.description}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div className="pb-drawer-comment__input-row">
              <textarea
                className="pb-drawer-comment__input"
                placeholder="Add a comment… (TODO: comments backend)"
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (process.env.NODE_ENV !== "test") {
                      // eslint-disable-next-line no-console
                      console.info(
                        "[playbook-drawer] comment composer is stubbed (AEL-61 follow-up)",
                      );
                    }
                    setDraft("");
                  }
                }}
                data-testid="pb-drawer-comment-input"
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

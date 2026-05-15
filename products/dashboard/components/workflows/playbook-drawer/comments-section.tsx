"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { ItemAvatar } from "@/components/framework/item-avatar";
import { cn } from "@/lib/utils";
import { actorInitials } from "@/lib/workflows/event-labels";
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
    <section
      className="pb-drawer-sec"
      data-testid="pb-drawer-comments-section"
      data-collapsed={!open}
    >
      <div className="pb-drawer-sec__head">
        <button
          type="button"
          className="pb-drawer-sec__toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          data-testid="pb-drawer-comments-toggle"
        >
          <ChevronRight
            size={12}
            className={cn(
              "pb-drawer-sec__chev",
              open && "pb-drawer-sec__chev--open",
            )}
            aria-hidden
          />
          <span className="pb-drawer-sec__lbl">
            Comments{" "}
            <span className="pb-drawer-sec__count">{comments.length}</span>
          </span>
        </button>
      </div>
      {open ? (
        <div className="pb-drawer-comments__list">
          {comments.length === 0 ? (
            <div className="pb-drawer-comments__empty">No comments yet.</div>
          ) : (
            comments.map((event) => {
              const author =
                (event.payload?.author as string | undefined)?.trim() ?? "Unknown";
              return (
                <div className="pb-drawer-comment" key={event.id}>
                  <ItemAvatar
                    initials={actorInitials(author)}
                    color="var(--accent)"
                    label={author}
                    size="xs"
                  />
                  <div className="pb-drawer-comment__body">
                    <div className="pb-drawer-comment__meta">
                      <strong>{author}</strong>
                      <span>{new Date(event.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="pb-drawer-comment__text">
                      {event.description}
                    </div>
                  </div>
                </div>
              );
            })
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
    </section>
  );
}

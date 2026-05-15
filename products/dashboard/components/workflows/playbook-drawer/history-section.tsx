"use client";

import { ChevronRight } from "lucide-react";

import { ItemAvatar } from "@/components/framework/item-avatar";
import { cn } from "@/lib/utils";
import { actorInitials, humanizeEvent } from "@/lib/workflows/event-labels";
import type { WorkflowEvent } from "@/lib/workflows/types";

export interface HistorySectionProps {
  events: WorkflowEvent[];
  open: boolean;
  onToggle: () => void;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function HistorySection({ events, open, onToggle }: HistorySectionProps) {
  return (
    <section
      className="pb-drawer-sec"
      data-testid="pb-drawer-history-section"
      data-collapsed={!open}
    >
      <div className="pb-drawer-sec__head">
        <button
          type="button"
          className="pb-drawer-sec__toggle"
          onClick={onToggle}
          aria-expanded={open}
          data-testid="pb-drawer-history-toggle"
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
            History{" "}
            <span className="pb-drawer-sec__count">{events.length}</span>
          </span>
        </button>
      </div>
      {open ? (
        <div className="pb-drawer-events" data-testid="pb-drawer-events-list">
          {events.length === 0 ? (
            <div className="pb-drawer-events__empty">No events yet.</div>
          ) : (
            events.map((event) => {
              const { title, actor, actorIsAgent } = humanizeEvent(event);
              return (
                <div className="pb-drawer-event" key={event.id}>
                  <ItemAvatar
                    emoji={actorIsAgent ? "🤖" : null}
                    initials={actorIsAgent ? null : actorInitials(actor)}
                    color="var(--accent)"
                    label={actor}
                    size="xs"
                  />
                  <div className="pb-drawer-event__body">
                    <div className="pb-drawer-event__title">{title}</div>
                    <div className="pb-drawer-event__sub">
                      by {actor} · {formatTime(event.createdAt)}
                    </div>
                    {event.description ? (
                      <div className="pb-drawer-event__desc">
                        {event.description}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </section>
  );
}

"use client";

import { ChevronRight, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
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
    <section className="pb-drawer-sec" data-testid="pb-drawer-history-section">
      <button
        type="button"
        className="pb-drawer-history-row"
        onClick={onToggle}
        data-testid="pb-drawer-history-toggle"
      >
        <span className="pb-drawer-history-row__left">
          <Clock size={11} aria-hidden /> History · {events.length} events
        </span>
        <ChevronRight
          size={11}
          className={cn(
            "pb-drawer-history-row__chev",
            open && "pb-drawer-history-row__chev--open",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="pb-drawer-events" data-testid="pb-drawer-events-list">
          {events.length === 0 ? (
            <div className="pb-drawer-events__empty">No events yet.</div>
          ) : (
            events.map((event) => (
              <div className="pb-drawer-event" key={event.id}>
                <div className="pb-drawer-event__time">{formatTime(event.createdAt)}</div>
                <div className="pb-drawer-event__body">
                  <div className="pb-drawer-event__name">{event.name}</div>
                  {event.description ? (
                    <div className="pb-drawer-event__desc">{event.description}</div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}

import type { WorkflowEvent } from "@/lib/workflows/types";

/**
 * Recent Events card — last N rows from `workflow_events`.
 *
 * Visual contract: prototype `.ev-row` block (`Process Canvas.html`
 * lines 416-422) and the OverviewScreen events list
 * (`pc-components.jsx` line 805). The accent dot · monospace event
 * name · description · relative timestamp pattern stays intact.
 *
 * Server-rendered. Timestamps render as a stable absolute value
 * (`HH:mm`) plus a relative hint computed against the current request
 * time so SSR and client hydration agree even when the user keeps the
 * tab open for hours.
 */
export interface RecentEventsCardProps {
  events: WorkflowEvent[];
  /** Used as `now` so server and any test harness can pin time. */
  now?: Date;
}

function formatRelative(then: Date, now: Date): string {
  const diffMs = now.getTime() - then.getTime();
  if (diffMs < 0) return "just now";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return then.toISOString().slice(0, 10);
}

export function RecentEventsCard({
  events,
  now = new Date(),
}: RecentEventsCardProps) {
  return (
    <section
      data-testid="overview-recent-events"
      className="overflow-hidden rounded-[10px] border border-border bg-bg-2"
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-[12px] font-semibold text-t1">Recent events</h2>
      </header>

      {events.length === 0 ? (
        <p className="px-4 py-7 text-center text-[12px] text-t2">
          No events yet. Workflow domain events will land here as agents run.
        </p>
      ) : (
        <ul className="divide-y divide-border-2">
          {events.map((event) => {
            // `event.createdAt` is typed as a string but actually
            // arrives as JSON from Supabase, so a malformed timestamp
            // (or a future field-rename mishap) could yield an Invalid
            // Date here. Guard once so `formatRelative` never receives
            // `NaN` and the whole card never throws on render.
            const ts = new Date(event.createdAt);
            const tsValid = !Number.isNaN(ts.getTime());
            return (
              <li
                key={event.id}
                data-testid={`overview-event-${event.id}`}
                className="flex gap-2.5 px-4 py-2.5"
              >
                <span
                  aria-hidden
                  className="mt-[5px] block h-[5px] w-[5px] shrink-0 rounded-full bg-accent"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[11px] text-accent">
                    {event.name}
                  </div>
                  {event.description && (
                    <div className="text-[11px] text-t2">
                      {event.description}
                    </div>
                  )}
                  <div className="font-mono text-[10px] text-t3">
                    {tsValid ? (
                      <time dateTime={event.createdAt}>
                        {formatRelative(ts, now)}
                      </time>
                    ) : (
                      <span aria-label="Unknown event time">—</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

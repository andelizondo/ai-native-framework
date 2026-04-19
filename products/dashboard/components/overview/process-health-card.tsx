import Link from "next/link";

import type { TemplateHealth } from "@/lib/workflows/aggregate";

/**
 * Process Health card — one row per template summarising rollup
 * completion across that template's instances. Instance chips are
 * `<Link>`s into `/workflows/[id]` so the founder can jump from the
 * stat surface straight into the matrix view (instances chip click
 * requirement on AEL-49).
 *
 * Visual contract: prototype `.proc-health-row` block + chip styling
 * (`Process Canvas.html` lines 383-395). Rendered server-side; chips
 * are anchor tags so right-click / open-in-new-tab still works.
 *
 * Empty workspaces fall back to a single dashed placeholder row so the
 * card never collapses to zero height during onboarding.
 */
export interface ProcessHealthCardProps {
  health: TemplateHealth[];
}

export function ProcessHealthCard({ health }: ProcessHealthCardProps) {
  return (
    <section
      data-testid="overview-process-health"
      className="overflow-hidden rounded-[10px] border border-border bg-bg-2"
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-[12px] font-semibold text-t1">Process health</h2>
      </header>

      {health.length === 0 ? (
        <p className="px-4 py-7 text-center text-[12px] text-t2">
          No workflow templates yet — process health will appear here once you
          define one.
        </p>
      ) : (
        <ul className="divide-y divide-border-2">
          {health.map(({ template, instances, completionPct }) => (
            <li
              key={template.id}
              data-testid={`overview-process-health-row-${template.id}`}
              className="flex items-center gap-3 px-4 py-3"
            >
              <span
                aria-hidden
                className="block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: template.color }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-t1">
                  {template.label}
                </div>
                {instances.length === 0 ? (
                  <p className="mt-1 font-mono text-[10px] text-t3">
                    No instances yet
                  </p>
                ) : (
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {instances.map((instance) => (
                      <li key={instance.id}>
                        <Link
                          href={`/workflows/${instance.id}`}
                          data-testid={`overview-instance-chip-${instance.id}`}
                          className="inline-flex items-center rounded-[5px] border border-border bg-bg-3 px-1.5 py-[2px] text-[10px] text-t2 transition-colors hover:border-primary hover:bg-primary-bg hover:text-accent"
                        >
                          {instance.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-mono text-[10px] text-t3">
                  {completionPct}%
                </span>
                <span
                  aria-hidden
                  className="block h-[3px] w-20 overflow-hidden rounded-[2px] bg-bg-4"
                >
                  <span
                    className="block h-full rounded-[2px]"
                    style={{
                      width: `${completionPct}%`,
                      backgroundColor: template.color,
                    }}
                  />
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

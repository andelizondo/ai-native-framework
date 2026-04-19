import { ShellEvents } from "@/components/shell-events";

/**
 * Overview — default authenticated route.
 *
 * Layout mirrors the AI-Native Process Canvas prototype's Overview
 * screen (`Process Canvas.html → OverviewScreen`): a greeting band,
 * four stat cards across the top, then a two-column grid of "Process
 * health", "Recent events", "My tasks", and "Agent pulse" cards.
 *
 * PR-3 ships the structure with zero-value stat cards and explicit
 * empty states. The data wiring (workflow instances, agent pulse,
 * checkpoint queue, event feed) lands in later PRs once the
 * underlying domain models exist.
 */

const STATS: ReadonlyArray<{ value: string; label: string; hint: string }> = [
  { value: "0", label: "Active instances", hint: "No workflows running" },
  { value: "0", label: "My tasks", hint: "All clear" },
  { value: "0", label: "Active tasks", hint: "No agents running" },
  { value: "0%", label: "Completion", hint: "0 / 0 tasks" },
];

function StatCard({ value, label, hint }: { value: string; label: string; hint: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-bg-2 px-4 py-3.5">
      <div className="font-mono text-[26px] font-extrabold leading-none tracking-tight text-t1">
        {value}
      </div>
      {/*
       * Use `text-t2` (not `text-t3`) for the small stat metadata. In the
       * light theme `--t3` (#94a3b8) on `--bg`/`--bg-2` lands at ~2.5:1,
       * below the WCAG-AA 4.5:1 floor for body text. Bumping to `--t2`
       * (#475569) clears 7:1 in light and 9:1+ in dark.
       */}
      <div className="mt-1.5 text-[11px] text-t2">{label}</div>
      <div className="mt-1 font-mono text-[10px] text-t2">{hint}</div>
    </div>
  );
}

function EmptyCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-border bg-bg-2">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-[12px] font-semibold text-t1">{title}</h2>
      </header>
      {/* See note in `StatCard` — empty-state copy uses `text-t2` so light
          theme stays above the WCAG-AA 4.5:1 contrast floor. */}
      <p className="px-4 py-7 text-center text-[12px] text-t2">{body}</p>
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      {/* Emits dashboard.shell_viewed on mount and tags Sentry with the
          workflow_canvas component for this shell. */}
      <ShellEvents route="/" />

      <div className="overflow-y-auto p-6">
        <header className="mb-5">
          <h1 className="text-[20px] font-bold tracking-tight text-t1">
            Welcome back.
          </h1>
          <p className="mt-1 text-[13px] text-t2">
            No workflows running yet. Define a workflow template to start
            tracking instances here.
          </p>
        </header>

        <div className="mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {STATS.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-3">
            <EmptyCard
              title="Process health"
              body="No workflow templates yet — process health will appear here once you define one."
            />
            <EmptyCard
              title="Recent events"
              body="No events captured yet. The shell, auth, and future workflow events will surface here."
            />
          </div>
          <div className="flex flex-col gap-3">
            <EmptyCard
              title="My tasks"
              body="All clear. Pending checkpoint approvals will land here as workflows run."
            />
            <EmptyCard
              title="Agent pulse"
              body="No agents running. Active and idle agents will appear here once workflows execute."
            />
          </div>
        </div>
      </div>
    </>
  );
}

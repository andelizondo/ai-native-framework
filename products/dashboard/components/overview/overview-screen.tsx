import { OverviewEvents } from "./overview-events";
import { ProcessHealthCard } from "./process-health-card";
import { MyTasksCard } from "./my-tasks-card";
import { InProgressTasksCard } from "./in-progress-tasks-card";
import { RecentEventsCard } from "./recent-events-card";
import { StatCard } from "./stat-card";
import type { AuthUser } from "@/lib/auth/types";
import {
  computeOverviewStats,
  computeTemplateHealth,
  pickActiveTasks,
  pickPendingCheckpoints,
  pickRecentEvents,
  type OverviewSnapshot,
} from "@/lib/workflows/aggregate";

/**
 * OverviewScreen — full Overview surface composed from the snapshot
 * the page server component fetched.
 *
 * Visual contract: prototype `OverviewScreen` (`pc-components.jsx`
 * lines 771-819, CSS lines 368-422 in `Process Canvas.html`):
 * greeting + 4 stat cards across the top, then a 2-col grid:
 *   - left column: Process health + Recent events
 *   - right column: My tasks + Agent pulse
 *
 * Pure server component; the only interactive children are
 * `<OverviewEvents />` (mount analytics) and `<MyTasksCard />`
 * (Approve/Reject server-action wiring).
 */
function timeOfDayGreeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function firstNameFromUser(user: AuthUser | null): string {
  const handle = (user?.email?.split("@")[0] ?? "").trim();
  if (!handle) return "there";
  // Capitalize the first letter only — the email handle is typically
  // lowercase ("andres") and a sentence-cased greeting reads warmer.
  return handle.charAt(0).toUpperCase() + handle.slice(1);
}

export interface OverviewScreenProps {
  snapshot: OverviewSnapshot;
  user: AuthUser | null;
  /** Pinned to keep SSR + tests deterministic. */
  now?: Date;
  /** How many recent events to render. Defaults to 4 per the issue. */
  recentEventLimit?: number;
}

export function OverviewScreen({
  snapshot,
  user,
  now = new Date(),
  recentEventLimit = 4,
}: OverviewScreenProps) {
  const stats = computeOverviewStats(snapshot);
  const health = computeTemplateHealth(snapshot);
  const checkpoints = pickPendingCheckpoints(snapshot);
  const activeTasks = pickActiveTasks(snapshot);
  const recentEvents = pickRecentEvents(snapshot, recentEventLimit);

  const greeting = `${timeOfDayGreeting(now)}, ${firstNameFromUser(user)}.`;
  const subtitle =
    stats.pendingTasks > 0
      ? stats.pendingTasks === 1
        ? "1 task needs your decision."
        : `${stats.pendingTasks} tasks need your decision.`
      : "All processes running smoothly.";

  // Pre-format the four stat cards so the JSX reads top-to-bottom.
  const statCards = [
    {
      key: "instances",
      value: String(stats.activeInstances),
      label: "Active instances",
      hint:
        snapshot.instances.length === 0
          ? "No workflows yet"
          : `${snapshot.instances.length} total`,
      tone: snapshot.instances.length === 0 ? "mute" : "up",
    },
    {
      key: "pending",
      value: String(stats.pendingTasks),
      label: "My tasks",
      hint: stats.pendingTasks > 0 ? "Action required" : "All clear",
      tone: stats.pendingTasks > 0 ? "warn" : "up",
    },
    {
      key: "active",
      value: String(stats.activeTasks),
      label: "Active tasks",
      hint:
        stats.activeTasks > 0
          ? `${stats.activeTasks} in flight`
          : "No tasks running",
      tone: stats.activeTasks > 0 ? "up" : "mute",
    },
    {
      key: "completion",
      value: `${stats.completionPct}%`,
      label: "Completion",
      hint: `${stats.completedTasks} / ${stats.totalTasks} tasks`,
      tone: stats.totalTasks === 0 ? "mute" : "up",
    },
  ] as const;

  return (
    <>
      <OverviewEvents
        instanceCount={stats.activeInstances}
        pendingCount={stats.pendingTasks}
        activeCount={stats.activeTasks}
        completionPct={stats.completionPct}
      />

      <div className="overflow-y-auto p-6">
        <header className="mb-5">
          <h1
            data-testid="overview-greeting"
            className="text-[20px] font-bold tracking-tight text-t1"
          >
            {greeting}
          </h1>
          <p className="mt-1 text-[13px] text-t2">{subtitle}</p>
        </header>

        <div
          data-testid="overview-stats"
          className="mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4"
        >
          {statCards.map((card) => (
            <StatCard
              key={card.key}
              value={card.value}
              label={card.label}
              hint={card.hint}
              tone={card.tone}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-3">
            <ProcessHealthCard health={health} />
            <RecentEventsCard events={recentEvents} now={now} />
          </div>
          <div className="flex flex-col gap-3">
            <MyTasksCard checkpoints={checkpoints} />
            <InProgressTasksCard tasks={activeTasks} />
          </div>
        </div>
      </div>
    </>
  );
}

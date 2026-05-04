import { ShellEvents } from "@/components/shell-events";
import { OverviewScreen } from "@/components/overview/overview-screen";
import { getCurrentUser } from "@/lib/auth/service.server";
import { captureError } from "@/lib/monitoring";
import type { OverviewSnapshot } from "@/lib/workflows/aggregate";
import type { FrameworkItem } from "@/lib/workflows/types";
import { getServerWorkflowRepository } from "@/lib/workflows/repository.server";

/**
 * Overview — default authenticated route.
 *
 * Reads templates / instances / tasks / recent events from the
 * workflow repository (cookie-aware Supabase, RLS in effect) and hands
 * the snapshot to `<OverviewScreen />` for rendering. The screen
 * itself is the single source of truth for layout and aggregation.
 *
 * Failure mode: if the repo throws (Supabase down, mis-applied RLS,
 * network blip), we capture the error to Sentry and fall back to an
 * empty snapshot so the chrome (sidebar, top bar, greeting) still
 * renders. The user sees the "All clear" + dashed empty-state cards
 * instead of a 500.
 */
export const dynamic = "force-dynamic";

const RECENT_EVENT_LIMIT = 4;

async function loadOverviewSnapshot(): Promise<{
  snapshot: OverviewSnapshot;
  playbooks: FrameworkItem[];
}> {
  try {
    const repo = await getServerWorkflowRepository();
    const [templates, instances, tasks, events, playbooks] = await Promise.all([
      repo.getTemplates(),
      repo.listInstances(),
      repo.listAllTasks(),
      repo.listRecentEvents(RECENT_EVENT_LIMIT),
      repo.getFrameworkItems("playbook"),
    ]);
    return { snapshot: { templates, instances, tasks, events }, playbooks };
  } catch (error) {
    captureError(error, { feature: "overview.snapshot" });
    return {
      snapshot: { templates: [], instances: [], tasks: [], events: [] },
      playbooks: [],
    };
  }
}

export default async function HomePage() {
  // Layout already redirects unauthenticated users; we still read the
  // user here to personalize the greeting without re-validating auth.
  const [user, { snapshot, playbooks }] = await Promise.all([
    getCurrentUser(),
    loadOverviewSnapshot(),
  ]);

  return (
    <>
      <ShellEvents route="/" />
      <OverviewScreen
        snapshot={snapshot}
        user={user}
        playbooks={playbooks}
        recentEventLimit={RECENT_EVENT_LIMIT}
      />
    </>
  );
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/service.server";
import { Sidebar } from "@/components/sidebar";
import type { SidebarInstanceView } from "@/components/workflows/sidebar-workflow-tree";
import { TopBar } from "@/components/top-bar";
import { AuthIdentitySync } from "@/components/auth-identity-sync";
import { captureError } from "@/lib/monitoring";
import { getServerWorkflowRepository } from "@/lib/workflows/repository.server";
import type { WorkflowInstance, WorkflowTemplate } from "@/lib/workflows/types";

/**
 * Server-side load of the workflow tree data the sidebar renders.
 *
 * Returns empty arrays / maps on failure so a transient Supabase error
 * never takes down the entire dashboard chrome — the sidebar renders the
 * dashed empty-state placeholder instead. Sentry still receives the
 * error via the canonical `captureError` so we can see it in production.
 */
async function loadSidebarWorkflowTree(): Promise<{
  templates: WorkflowTemplate[];
  instancesByTemplate: Record<string, SidebarInstanceView[]>;
}> {
  try {
    const repo = await getServerWorkflowRepository();
    const [templates, instances] = await Promise.all([
      repo.getTemplates(),
      repo.listInstances(),
    ]);

    const instancesByTemplate: Record<string, SidebarInstanceView[]> = {};
    for (const instance of instances satisfies WorkflowInstance[]) {
      const bucket = instancesByTemplate[instance.templateId] ?? [];
      // PR 5 has no per-task aggregation yet; `hasPending` and `progress`
      // light up automatically when PR 8 wires task state.
      bucket.push({ ...instance });
      instancesByTemplate[instance.templateId] = bucket;
    }

    return { templates, instancesByTemplate };
  } catch (error) {
    captureError(error, { feature: "sidebar.workflow_tree" });
    return { templates: [], instancesByTemplate: {} };
  }
}

/**
 * Authenticated dashboard shell.
 *
 * Layout: full-viewport flex row with the persistent <Sidebar /> rail on
 * the left and a vertically-stacked main column on the right. The body
 * (`app/layout.tsx`) already enforces `h-screen flex overflow-hidden`,
 * so the sidebar provides its own width and the main column flexes to
 * fill the remaining space and owns its own overflow.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { templates, instancesByTemplate } = await loadSidebarWorkflowTree();

  return (
    <>
      <AuthIdentitySync user={user} provider={user.provider} />
      <Sidebar
        user={user}
        templates={templates}
        instancesByTemplate={instancesByTemplate}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="min-h-0 flex-1 overflow-y-auto bg-bg">{children}</main>
      </div>
    </>
  );
}

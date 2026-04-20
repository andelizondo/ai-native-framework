import { notFound } from "next/navigation";

import { ShellEvents } from "@/components/shell-events";
import { ProcessMatrix } from "@/components/workflows/process-matrix";
import { getServerWorkflowRepository } from "@/lib/workflows/repository.server";

/**
 * Workflow instance route.
 *
 * Renders the read-only Process Matrix for the requested instance.
 * The matrix component owns layout (sticky header / role column,
 * pip strip, role collapse) and visual state (bar-* classes); this
 * route just resolves the instance + template and frames the page
 * header above the canvas.
 *
 * Failure modes:
 * - Instance not found → standard 404 (preserves the AEL-48 contract
 *   where stale links produce a clean Not Found page rather than
 *   crashing the dashboard shell).
 * - Template missing (instance row references a deleted template):
 *   render the matrix shell with a friendly placeholder so QA can
 *   still observe the page rather than a hard crash. The instance
 *   row carries its own `roles` snapshot, so we still get the
 *   header counts right even without a template body.
 */

interface Params {
  instanceId: string;
}

export default async function WorkflowInstancePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { instanceId } = await params;
  const { edit } = await searchParams;
  const editMode = edit === "1";

  const repo = await getServerWorkflowRepository();
  const [instance, skills, playbooks] = await Promise.all([
    repo.getInstance(instanceId),
    repo.getFrameworkItems("skill"),
    repo.getFrameworkItems("playbook"),
  ]);

  if (!instance) {
    notFound();
  }

  const template = await repo.getTemplate(instance.templateId);

  return (
    <>
      <ShellEvents route="/workflows/[instanceId]" />

      <div className="flex h-full flex-col overflow-hidden">
        <header className="flex-shrink-0 border-b border-border bg-bg px-6 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-t3">
            Workflow instance
          </p>
          <h1 className="mt-1 text-[20px] font-bold tracking-tight text-t1">
            {instance.label}
          </h1>
          <p className="mt-1 text-[13px] text-t2">
            {instance.tasks.length}{" "}
            {instance.tasks.length === 1 ? "task" : "tasks"} ·{" "}
            {instance.roles.length}{" "}
            {instance.roles.length === 1 ? "role" : "roles"} · status{" "}
            <span className="font-medium text-t1">{instance.status}</span>
          </p>
        </header>

        <ProcessMatrix
          instance={instance}
          template={template}
          editMode={editMode}
          skillOptions={skills}
          playbookOptions={playbooks}
        />
      </div>
    </>
  );
}

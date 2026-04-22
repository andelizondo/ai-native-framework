import { notFound } from "next/navigation";

import { ShellEvents } from "@/components/shell-events";
import { ProcessMatrix } from "@/components/workflows/process-matrix";
import { WorkflowInstanceHeader } from "@/components/workflows/workflow-instance-header";
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
        <WorkflowInstanceHeader
          instanceLabel={instance.label}
          taskCount={instance.tasks.length}
          roleCount={instance.roles.length}
          stageCount={template?.stages.length ?? 0}
        />

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

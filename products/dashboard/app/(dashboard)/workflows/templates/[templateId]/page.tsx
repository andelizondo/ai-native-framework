import Link from "next/link";
import { notFound } from "next/navigation";
import { PencilLine } from "lucide-react";

import { ShellEvents } from "@/components/shell-events";
import { TemplateOverviewMatrix } from "@/components/workflows/template-overview-matrix";
import { getServerWorkflowRepository } from "@/lib/workflows/repository.server";

/**
 * Template-level overview route — stacked status across every instance of
 * the template, grouped by template task (skill × stage cell). Pairs with
 * `/workflows/templates/[templateId]/edit` (template editor); this page is
 * read-only and answers "where is each playbook of the workflow currently
 * stuck across our live work?".
 */

interface Params {
  templateId: string;
}

export default async function WorkflowTemplateOverviewPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { templateId } = await params;
  const repo = await getServerWorkflowRepository();
  const [matrix, playbooks] = await Promise.all([
    repo.getTemplateMatrix(templateId),
    repo.getFrameworkItems("playbook"),
  ]);

  if (!matrix) {
    notFound();
  }

  const playbookNameById = new Map(playbooks.map((p) => [p.id, p.name]));

  return (
    <>
      <ShellEvents route="/workflows/templates/[templateId]" />
      <div className="flex h-full flex-col overflow-hidden">
        <header className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-border bg-bg px-6 py-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-t3">
              Workflow template
            </p>
            <h1 className="mt-1 text-[20px] font-bold tracking-tight text-t1">
              {matrix.template.label}
            </h1>
            <p className="mt-1 text-[13px] text-t2">
              {matrix.cells.length}{" "}
              {matrix.cells.length === 1 ? "playbook" : "playbooks"} ·{" "}
              {matrix.template.skills.length}{" "}
              {matrix.template.skills.length === 1 ? "skill" : "skills"} ·{" "}
              {matrix.template.stages.length}{" "}
              {matrix.template.stages.length === 1 ? "stage" : "stages"} ·{" "}
              {matrix.instances.length}{" "}
              {matrix.instances.length === 1 ? "instance" : "instances"}
            </p>
          </div>
          <Link
            href={`/workflows/templates/${matrix.template.id}/edit`}
            className="flex items-center gap-1.5 rounded-md border border-border bg-bg-2 px-2 py-1 text-[12px] text-t1 hover:bg-bg-3"
          >
            <PencilLine className="h-3.5 w-3.5" /> Edit template
          </Link>
        </header>
        <div className="flex-1 overflow-auto px-6 py-6">
          <TemplateOverviewMatrix
            matrix={matrix}
            playbookNameById={playbookNameById}
          />
        </div>
      </div>
    </>
  );
}

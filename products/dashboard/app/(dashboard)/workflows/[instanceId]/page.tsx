import { notFound } from "next/navigation";

import { ShellEvents } from "@/components/shell-events";
import { getServerWorkflowRepository } from "@/lib/workflows/repository.server";

/**
 * Workflow instance route — stub.
 *
 * PR 5 lands the routing target so the create-instance modal has
 * somewhere to navigate after a successful insert. The Process Matrix
 * canvas itself ships in PR 7; for now we render the instance label
 * and a placeholder note so the page is discoverable in QA without
 * inventing matrix UI we'd just throw away.
 */

interface Params {
  instanceId: string;
}

export default async function WorkflowInstancePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { instanceId } = await params;

  const repo = await getServerWorkflowRepository();
  const instance = await repo.getInstance(instanceId);

  if (!instance) {
    notFound();
  }

  return (
    <>
      <ShellEvents route="/workflows/[instanceId]" />

      <div className="overflow-y-auto p-6">
        <header className="mb-5">
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

        <section className="rounded-[10px] border border-dashed border-border bg-bg-2 px-6 py-10 text-center">
          <h2 className="text-[14px] font-semibold text-t1">
            Matrix coming in PR 7
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-[12px] text-t2">
            The Process Matrix view (sticky stage headers, role rows, task
            cards with state pills) lands once the core canvas component
            is ready. This page exists today so create-instance flows
            have a routing target.
          </p>
        </section>
      </div>
    </>
  );
}

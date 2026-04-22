import { notFound } from "next/navigation";

import { TemplateEditorScreen } from "@/components/workflows/template-editor-screen";
import { getServerWorkflowRepository } from "@/lib/workflows/repository.server";

interface Params {
  templateId: string;
}

export default async function WorkflowTemplateEditPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { templateId } = await params;
  const repo = await getServerWorkflowRepository();

  const [template, skillOptions, playbookOptions, instances] = await Promise.all([
    repo.getTemplate(templateId),
    repo.getFrameworkItems("skill"),
    repo.getFrameworkItems("playbook"),
    repo.listInstances(templateId),
  ]);

  if (!template) {
    notFound();
  }

  return (
    <TemplateEditorScreen
      template={template}
      instanceCount={instances.length}
      skillOptions={skillOptions}
      playbookOptions={playbookOptions}
    />
  );
}

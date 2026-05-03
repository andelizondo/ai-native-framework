import { FrameworkScreen } from "@/components/framework/framework-screen";
import { ShellEvents } from "@/components/shell-events";
import { getServerWorkflowRepository } from "@/lib/workflows/repository.server";

export default async function PlaybooksPage() {
  const repo = await getServerWorkflowRepository();
  const [items, skills] = await Promise.all([
    repo.getFrameworkItems("playbook"),
    repo.getFrameworkItems("skill"),
  ]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ShellEvents route="/framework/playbooks" />
      <div className="min-h-0 flex-1">
        <FrameworkScreen initialItems={items} type="playbook" availableSkills={skills} />
      </div>
    </div>
  );
}

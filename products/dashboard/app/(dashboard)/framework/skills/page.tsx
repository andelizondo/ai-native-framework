import { FrameworkScreen } from "@/components/framework/framework-screen";
import { ShellEvents } from "@/components/shell-events";
import { getServerWorkflowRepository } from "@/lib/workflows/repository.server";

export default async function SkillsPage() {
  const repo = await getServerWorkflowRepository();
  const items = await repo.getFrameworkItems("skill");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ShellEvents route="/framework/skills" />
      <div className="min-h-0 flex-1">
        <FrameworkScreen initialItems={items} type="skill" />
      </div>
    </div>
  );
}

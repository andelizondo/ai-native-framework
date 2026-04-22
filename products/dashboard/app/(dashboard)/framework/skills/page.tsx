import { FrameworkScreen } from "@/components/framework/framework-screen";
import { ShellEvents } from "@/components/shell-events";
import { getServerWorkflowRepository } from "@/lib/workflows/repository.server";

export default async function SkillsPage() {
  const repo = await getServerWorkflowRepository();
  const items = await repo.getFrameworkItems("skill");

  return (
    <>
      <ShellEvents route="/framework/skills" />
      <FrameworkScreen initialItems={items} type="skill" />
    </>
  );
}

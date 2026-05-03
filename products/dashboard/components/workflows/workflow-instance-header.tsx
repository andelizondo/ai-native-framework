interface WorkflowInstanceHeaderProps {
  instanceLabel: string;
  taskCount: number;
  skillCount: number;
  stageCount: number;
}

export function WorkflowInstanceHeader({
  instanceLabel,
  taskCount,
  skillCount,
  stageCount,
}: WorkflowInstanceHeaderProps) {
  return (
    <header className="flex flex-shrink-0 items-start border-b border-border bg-bg px-6 py-4">
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-t3">
          Workflow instance
        </p>
        <h1 className="mt-1 text-[20px] font-bold tracking-tight text-t1">
          {instanceLabel}
        </h1>
        <p className="mt-1 text-[13px] text-t2">
          {taskCount} {taskCount === 1 ? "task" : "tasks"} · {skillCount}{" "}
          {skillCount === 1 ? "skill" : "skills"} · {stageCount}{" "}
          {stageCount === 1 ? "stage" : "stages"}
        </p>
      </div>
    </header>
  );
}

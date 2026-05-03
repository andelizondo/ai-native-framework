import Link from "next/link";

import { cn } from "@/lib/utils";
import type { ActiveTask } from "@/lib/workflows/aggregate";

export interface InProgressTasksCardProps {
  tasks: ActiveTask[];
}

export function InProgressTasksCard({ tasks }: InProgressTasksCardProps) {
  return (
    <section
      data-testid="overview-in-progress-tasks"
      className="overflow-hidden rounded-[10px] border border-border bg-bg-2"
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-[12px] font-semibold text-t1">Tasks in progress</h2>
        {tasks.length > 0 && (
          <span className="rounded-full bg-primary-bg px-2 py-[1px] font-mono text-[10px] font-semibold text-accent">
            {tasks.length}
          </span>
        )}
      </header>

      {tasks.length === 0 ? (
        <p className="px-4 py-7 text-center text-[12px] text-t2">
          No tasks in progress
        </p>
      ) : (
        <ul className="divide-y divide-border-2">
          {tasks.map(({ task, instance, template }) => (
            <li key={task.id}>
              <Link
                href={`/workflows/${instance.id}`}
                data-testid={`overview-in-progress-task-${task.id}`}
                className="flex items-start gap-2.5 px-4 py-3 transition-colors hover:bg-bg-3 focus-visible:bg-bg-3 focus-visible:outline-none"
              >
                <div className="min-w-0 flex-1">
                  <p
                    className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-t3"
                    style={template ? { color: template.color } : undefined}
                  >
                    {template?.label ?? "Workflow"} · {instance.label}
                  </p>
                  <p className="mt-1 text-[12.5px] font-semibold text-t1">
                    {task.title}
                  </p>
                  {task.playbook && (
                    <p className="mt-1 truncate font-mono text-[11px] text-t3">
                      📘 {task.playbook}
                    </p>
                  )}
                </div>
                <span
                  aria-label="status active"
                  className={cn(
                    "mt-1.5 block h-[7px] w-[7px] shrink-0 rounded-full",
                    "bg-[color:#10b981] shadow-[0_0_6px_rgba(16,185,129,0.5)]",
                  )}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

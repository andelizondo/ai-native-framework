import Link from "next/link";

import {
  TASK_STATUS_LABEL,
  TASK_STATUS_ORDER,
  TASK_STATUS_VAR,
} from "@/lib/workflows/task-status";
import type {
  TemplateCellAggregate,
  TemplateMatrix,
  WorkflowTaskStatus,
} from "@/lib/workflows/types";

interface Props {
  matrix: TemplateMatrix;
  playbookNameById: Map<string, string>;
}

/**
 * Read-only matrix view that mirrors the per-instance Process Matrix layout
 * (skills as rows, stages as columns) but with each cell collapsed to a
 * stacked status bar across every instance of the template.
 *
 * Server-rendered: drill-down into a specific instance is just a `<Link>`
 * to the corresponding workflow instance page; the empty-instance case
 * (template with zero instances) renders a friendly placeholder instead
 * of an empty grid so the page never looks broken.
 */
export function TemplateOverviewMatrix({ matrix, playbookNameById }: Props) {
  const { template, instances, cells } = matrix;

  if (template.stages.length === 0 || template.skills.length === 0) {
    return (
      <p className="text-[13px] text-t3">
        This template has no stages or skills yet. Edit the template to
        define the matrix.
      </p>
    );
  }

  // Cells keyed by (skillId, stageId) for O(1) lookup while we iterate the
  // template's row × column shape.
  const cellByCoord = new Map<string, TemplateCellAggregate>();
  for (const c of cells) {
    cellByCoord.set(`${c.skillId}::${c.stageId}`, c);
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-2 text-[12px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-bg text-left">
              <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-t3">
                Skill ↓ / Stage →
              </span>
            </th>
            {template.stages.map((stage) => (
              <th
                key={stage.id}
                className="min-w-[180px] text-left align-bottom text-t1"
              >
                <div className="font-medium">{stage.label}</div>
                {stage.sub ? (
                  <div className="text-[10px] text-t3">{stage.sub}</div>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {template.skills.map((skill) => (
            <tr key={skill.id}>
              <th
                scope="row"
                className="sticky left-0 z-10 min-w-[140px] bg-bg text-left align-top font-medium text-t1"
              >
                {skill.label}
              </th>
              {template.stages.map((stage) => {
                const cell = cellByCoord.get(`${skill.id}::${stage.id}`);
                if (!cell) {
                  return <td key={stage.id} className="align-top" />;
                }
                return (
                  <td key={stage.id} className="align-top">
                    <CellPanel
                      cell={cell}
                      playbookName={
                        cell.playbookId
                          ? (playbookNameById.get(cell.playbookId) ?? cell.playbookId)
                          : "Unassigned"
                      }
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {instances.length === 0 ? (
        <p className="mt-6 text-[13px] text-t3">
          No instances of this template yet. Create one from the sidebar to
          start populating the rollup.
        </p>
      ) : null}
    </div>
  );
}

interface CellPanelProps {
  cell: TemplateCellAggregate;
  playbookName: string;
}

function CellPanel({ cell, playbookName }: CellPanelProps) {
  const total = cell.instances.length;
  const anyBlocked = cell.instances.some((i) => i.hasUnmetLinkedInput);
  return (
    <div className="rounded-md border border-border bg-bg-2 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className="truncate text-[12px] font-medium text-t1"
            title={playbookName}
          >
            {playbookName}
          </p>
          <p className="text-[10px] text-t3">
            {total} {total === 1 ? "instance" : "instances"}
            {anyBlocked ? " · blockers" : ""}
          </p>
        </div>
      </div>
      <StackedStatusBar counts={cell.statusCounts} total={total} />
      {total > 0 ? (
        <ul className="mt-2 space-y-0.5">
          {cell.instances.slice(0, 4).map((inst) => (
            <li key={inst.taskId} className="truncate text-[11px]">
              <Link
                href={`/workflows/${inst.instanceId}`}
                className="text-t2 hover:text-t1"
                title={`${inst.instanceLabel} · ${TASK_STATUS_LABEL[inst.status]}`}
              >
                <span
                  className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                  style={{ background: TASK_STATUS_VAR[inst.status] }}
                  aria-hidden
                />
                {inst.instanceLabel}
                {inst.hasUnmetLinkedInput ? (
                  <span className="ml-1 text-[color:var(--err,#dc2626)]">⚠</span>
                ) : null}
              </Link>
            </li>
          ))}
          {total > 4 ? (
            <li className="text-[10px] text-t3">+{total - 4} more</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

interface StackedStatusBarProps {
  counts: Record<WorkflowTaskStatus, number>;
  total: number;
}

function StackedStatusBar({ counts, total }: StackedStatusBarProps) {
  if (total === 0) {
    return (
      <div
        className="mt-2 h-2 w-full rounded-full bg-bg-3"
        aria-hidden
      />
    );
  }
  return (
    <div
      className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-bg-3"
      role="img"
      aria-label={TASK_STATUS_ORDER.filter((s) => counts[s] > 0)
        .map((s) => `${counts[s]} ${TASK_STATUS_LABEL[s]}`)
        .join(", ")}
    >
      {TASK_STATUS_ORDER.map((status) => {
        const count = counts[status] ?? 0;
        if (count === 0) return null;
        const pct = (count / total) * 100;
        return (
          <span
            key={status}
            style={{
              width: `${pct}%`,
              background: TASK_STATUS_VAR[status],
            }}
            title={`${count} ${TASK_STATUS_LABEL[status]}`}
          />
        );
      })}
    </div>
  );
}

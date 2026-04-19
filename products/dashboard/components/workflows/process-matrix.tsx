"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronsLeftRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { barClass, canStart } from "@/lib/workflows/matrix";
import { getRoleColor } from "@/lib/workflows/role-colors";
import type {
  WorkflowInstanceDetail,
  WorkflowRole,
  WorkflowStage,
  WorkflowTask,
  WorkflowTemplate,
} from "@/lib/workflows/types";

import { TaskCard } from "./task-card";
import { TaskDrawer } from "./task-drawer";

/**
 * Read-only Process Matrix.
 *
 * Visual contract: prototype `ProcessMatrix` (`pc-components.jsx`
 * lines 395-541) and the matrix CSS block (`Process Canvas.html`
 * lines 141-218). The structural pieces this PR ships:
 *
 *   - sticky stage header row (top: 0, blurred backdrop)
 *   - sticky `Roles` corner cell (left: 0)
 *   - per-stage pip strip (one pip per task in that stage, tinted by
 *     the task's role colour and dimmed by status)
 *   - sticky role column with a collapse toggle that narrows the
 *     column to a 44px swatch-only rail (label hidden)
 *   - 192px task cells with per-cell border separators
 *
 * Editing affordances (insert role, drag-reorder, add stage, etc.)
 * are intentionally absent for PR 7 — they ship in PR 11. A read-only
 * matrix unblocks the rest of the canvas (drawer, checkpoint panel)
 * without spinning matrix-editor logic into this slice.
 *
 * Roles preference: instance-level role list takes precedence so
 * `WorkflowRepository.createInstance` (which copies template roles
 * into the instance row) is the single source of truth for what the
 * user sees. Falls back to the template's role list if the instance
 * row was somehow seeded without roles.
 */
interface Props {
  instance: WorkflowInstanceDetail;
  /** Template the matrix renders against; null = template missing. */
  template: WorkflowTemplate | null;
}

export function ProcessMatrix({ instance, template }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  // Local optimistic task list so approve/reject update the bar immediately.
  const [localTasks, setLocalTasks] = useState<WorkflowTask[]>(instance.tasks);

  const handleTaskUpdate = useCallback((updated: WorkflowTask) => {
    setLocalTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }, []);

  // Derive stages, roles, and the (role, stage) -> task index up
  // front. The matrix re-renders on every collapse toggle, so we
  // memoise the lookup map to keep the inner cell loop O(1).
  const stages: WorkflowStage[] = template?.stages ?? [];
  const roles: WorkflowRole[] =
    instance.roles && instance.roles.length > 0
      ? instance.roles
      : template?.roles ?? [];

  const tasksByCell = useMemo(() => {
    const map = new Map<string, WorkflowTask>();
    for (const task of localTasks) {
      map.set(`${task.roleId}::${task.stageId}`, task);
    }
    return map;
  }, [localTasks]);

  const tasksByStage = useMemo(() => {
    const map = new Map<string, WorkflowTask[]>();
    for (const task of localTasks) {
      const bucket = map.get(task.stageId) ?? [];
      bucket.push(task);
      map.set(task.stageId, bucket);
    }
    return map;
  }, [localTasks]);

  const selectedTask = selectedTaskId
    ? (localTasks.find((t) => t.id === selectedTaskId) ?? null)
    : null;

  // Empty state: a template with no stages OR no roles can't paint a
  // grid. Render the matrix shell + a friendly placeholder so QA can
  // still verify the route renders.
  const isEmpty = stages.length === 0 || roles.length === 0;

  return (
    <>
      <div
        data-testid="process-matrix"
        data-collapsed={collapsed ? "true" : "false"}
        className={cn(
          "matrix-wrap",
          collapsed && "roles-collapsed",
        )}
    >
      <div
        className="matrix"
        role="table"
        aria-label="Workflow process matrix"
      >
        <div className="matrix-head-row" role="row">
          <div className="mx-corner" role="columnheader">
            {!collapsed && <span className="flex-1">Roles</span>}
            <button
              type="button"
              data-testid="matrix-roles-toggle"
              aria-pressed={collapsed}
              aria-label={collapsed ? "Expand role labels" : "Collapse role labels"}
              title={collapsed ? "Expand role labels" : "Collapse role labels"}
              onClick={() => setCollapsed((value) => !value)}
              className="mx-corner-toggle"
              style={collapsed ? { marginLeft: 0 } : undefined}
            >
              <ChevronsLeftRight aria-hidden size={11} />
            </button>
          </div>
          {stages.map((stage) => {
            const stageTasks = tasksByStage.get(stage.id) ?? [];
            return (
              <div
                key={stage.id}
                role="columnheader"
                className="mx-stage-hd"
                data-testid={`matrix-stage-${stage.id}`}
              >
                <div className="mx-stage-name">{stage.label}</div>
                {stage.sub ? (
                  <div className="mx-stage-sub">{stage.sub}</div>
                ) : null}
                {stageTasks.length > 0 && (
                  <div className="mx-stage-pips" aria-hidden>
                    {stageTasks.map((task) => {
                      const color = getRoleColor(task.roleId, roles);
                      const opacity =
                        task.status === "not_started"
                          ? 0.2
                          : task.status === "complete"
                            ? 0.5
                            : 1;
                      return (
                        <div
                          key={task.id}
                          data-testid={`matrix-pip-${task.id}`}
                          className="mx-pip"
                          style={{ background: color, opacity }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {isEmpty ? (
          <div role="row" data-testid="matrix-empty" className="border-t border-border-2">
            <div
              role="cell"
              aria-colspan={Math.max(1, 1 + stages.length)}
              className="px-4 py-6 text-center text-[12px] text-t2"
            >
              {template
                ? "This workflow has no stages or roles defined yet."
                : "The template that defines this workflow is no longer available."}
            </div>
          </div>
        ) : (
          roles.map((role) => {
            const roleColor = getRoleColor(role.id, roles);
            return (
              <div
                key={role.id}
                role="row"
                className="mx-body-row"
                data-testid={`matrix-role-row-${role.id}`}
              >
                <div className="mx-role-cell" role="rowheader">
                  <span
                    aria-hidden
                    data-testid={`matrix-role-dot-${role.id}`}
                    className="block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: roleColor }}
                  />
                  {!collapsed && (
                    <div
                      className="min-w-0 flex-1"
                      data-testid={`matrix-role-label-${role.id}`}
                    >
                      <div className="mx-role-name">{role.label}</div>
                      {role.owner ? (
                        <div className="mx-role-owner">{role.owner}</div>
                      ) : null}
                    </div>
                  )}
                </div>
                {stages.map((stage) => {
                  const task = tasksByCell.get(`${role.id}::${stage.id}`);
                  return (
                    <div
                      key={`${role.id}-${stage.id}`}
                      role="cell"
                      data-testid={`matrix-cell-${role.id}-${stage.id}`}
                      className={cn(
                        "mx-task-cell",
                        task ? "has-task" : undefined,
                      )}
                    >
                      {task ? (
                        <TaskCard
                          task={task}
                          roleColor={roleColor}
                          barState={barClass(task, canStart(task, localTasks))}
                          onClick={() => setSelectedTaskId(task.id)}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>

    {selectedTask && (
      <TaskDrawer
        task={selectedTask}
        instance={instance}
        roles={roles}
        template={template}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdate={handleTaskUpdate}
      />
    )}
  </>
  );
}


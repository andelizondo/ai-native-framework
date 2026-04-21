"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ChevronsLeftRight, Plus } from "lucide-react";

import {
  createTaskAction,
  deleteTaskAction,
  moveTaskAction,
} from "@/app/(dashboard)/workflows/actions";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { captureError } from "@/lib/monitoring";
import { cn } from "@/lib/utils";
import { barClass, canStart } from "@/lib/workflows/matrix";
import { getRoleColor } from "@/lib/workflows/role-colors";
import type {
  FrameworkItem,
  WorkflowInstanceDetail,
  WorkflowRole,
  WorkflowStage,
  WorkflowTask,
  WorkflowTemplate,
} from "@/lib/workflows/types";

import { AddTaskModal } from "./add-task-modal";
import { AgentRunPanel } from "./agent-run-panel";
import { TaskCard } from "./task-card";
import { TaskDrawer } from "./task-drawer";

interface Props {
  instance: WorkflowInstanceDetail;
  template: WorkflowTemplate | null;
  editMode?: boolean;
  skillOptions?: FrameworkItem[];
  playbookOptions?: FrameworkItem[];
}

export function ProcessMatrix({
  instance,
  template,
  editMode = false,
  skillOptions = [],
  playbookOptions = [],
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [addTaskFor, setAddTaskFor] = useState<{
    roleId: string;
    roleName: string;
    stageId: string;
    stageName: string;
  } | null>(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<WorkflowTask | null>(
    null,
  );
  const [agentRunOpen, setAgentRunOpen] = useState(false);
  const [localTasks, setLocalTasks] = useState<WorkflowTask[]>(instance.tasks);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setLocalTasks(instance.tasks);
  }, [instance.tasks]);

  const handleTaskUpdate = useCallback((updated: WorkflowTask) => {
    setLocalTasks((prev) => prev.map((task) => (task.id === updated.id ? updated : task)));
  }, []);

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
    ? (localTasks.find((task) => task.id === selectedTaskId) ?? null)
    : null;

  const isEmpty = stages.length === 0 || roles.length === 0;

  const runMutation = useCallback(
    async (
      apply: (tasks: WorkflowTask[]) => WorkflowTask[],
      commit: () => Promise<WorkflowTask | void>,
    ) => {
      const snapshot = localTasks;
      const optimistic = apply(snapshot);
      const snapshotById = new Map(snapshot.map((task) => [task.id, task]));
      const optimisticById = new Map(optimistic.map((task) => [task.id, task]));
      const changedTaskIds = new Set<string>();

      for (const task of snapshot) {
        if (optimisticById.get(task.id) !== task) {
          changedTaskIds.add(task.id);
        }
      }
      for (const task of optimistic) {
        if (snapshotById.get(task.id) !== task) {
          changedTaskIds.add(task.id);
        }
      }

      setLocalTasks((current) => apply(current));

      startTransition(async () => {
        try {
          const result = await commit();
          if (result) {
            setLocalTasks((current) =>
              current.some((task) => task.id === result.id)
                ? current.map((task) => (task.id === result.id ? result : task))
                : [...current, result],
            );
          }
        } catch (error) {
          setLocalTasks((current) => {
            const reverted: WorkflowTask[] = [];
            const restoredIds = new Set<string>();

            for (const task of current) {
              if (!changedTaskIds.has(task.id)) {
                reverted.push(task);
                continue;
              }

              const snapshotTask = snapshotById.get(task.id);
              if (snapshotTask) {
                reverted.push(snapshotTask);
                restoredIds.add(task.id);
              }
            }

            for (const task of snapshot) {
              if (changedTaskIds.has(task.id) && !restoredIds.has(task.id)) {
                reverted.push(task);
              }
            }

            return reverted;
          });
          captureError(error, { feature: "workflows.process_matrix_edit" });
        }
      });
    },
    [localTasks],
  );

  return (
    <>
      <div
        data-testid="process-matrix"
        data-collapsed={collapsed ? "true" : "false"}
        className={cn("matrix-wrap", collapsed && "roles-collapsed")}
      >
        <div className="matrix" role="table" aria-label="Workflow process matrix">
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
                  <div className={cn("mx-stage-sub", stage.sub?.trim() && "mx-stage-sub-plain")}>
                    {stage.sub?.trim() || "No description"}
                  </div>
                  {stageTasks.length > 0 ? (
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
                  ) : null}
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
                    {!collapsed ? (
                      <div
                        className="min-w-0 flex-1"
                        data-testid={`matrix-role-label-${role.id}`}
                      >
                        <div className="mx-role-name">{role.label}</div>
                        <div className={cn("mx-role-owner", role.owner?.trim() && "mx-role-owner-plain")}>
                          {role.owner?.trim() || "No description"}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {stages.map((stage) => {
                    const cellKey = `${role.id}-${stage.id}`;
                    const task = tasksByCell.get(`${role.id}::${stage.id}`);

                    return (
                      <div
                        key={cellKey}
                        role="cell"
                        data-testid={`matrix-cell-${role.id}-${stage.id}`}
                        className={cn(
                          "mx-task-cell",
                          task && "has-task",
                          dragOverCell === cellKey && "drag-over-cell",
                        )}
                        onDragOver={
                          editMode
                            ? (event) => {
                                if (!dragTaskId || task) return;
                                event.preventDefault();
                                setDragOverCell(cellKey);
                              }
                            : undefined
                        }
                        onDragLeave={
                          editMode
                            ? () => {
                                setDragOverCell((current) =>
                                  current === cellKey ? null : current,
                                );
                              }
                            : undefined
                        }
                        onDrop={
                          editMode
                            ? (event) => {
                                event.preventDefault();
                                const droppedTaskId =
                                  event.dataTransfer.getData("taskId") || dragTaskId;
                                setDragTaskId(null);
                                setDragOverCell(null);
                                if (!droppedTaskId || task) return;

                                runMutation(
                                  (tasks) =>
                                    tasks.map((item) =>
                                      item.id === droppedTaskId
                                        ? { ...item, roleId: role.id, stageId: stage.id }
                                        : item,
                                    ),
                                  async () => {
                                    const result = await moveTaskAction(
                                      droppedTaskId,
                                      role.id,
                                      stage.id,
                                    );
                                    return result.task;
                                  },
                                );
                              }
                            : undefined
                        }
                      >
                        {task ? (
                          <TaskCard
                            task={task}
                            roleColor={roleColor}
                            barState={barClass(task, canStart(task, localTasks))}
                            editMode={editMode}
                            draggable
                            onClick={() => setSelectedTaskId(task.id)}
                            onEdit={editMode ? () => setSelectedTaskId(task.id) : undefined}
                            onRemove={
                              editMode ? () => setConfirmDeleteTask(task) : undefined
                            }
                            onDragStart={
                              editMode
                                ? (event) => {
                                    event.dataTransfer.setData("taskId", task.id);
                                    setDragTaskId(task.id);
                                  }
                                : undefined
                            }
                            onDragEnd={
                              editMode
                                ? () => {
                                    setDragTaskId(null);
                                    setDragOverCell(null);
                                  }
                                : undefined
                            }
                          />
                        ) : editMode ? (
                          <div
                            className="mx-empty-cell"
                            onClick={() =>
                              setAddTaskFor({
                                roleId: role.id,
                                roleName: role.label,
                                stageId: stage.id,
                                stageName: stage.label,
                              })
                            }
                          >
                            <button
                              type="button"
                              className="mx-add-btn"
                              data-testid={`matrix-add-task-${role.id}-${stage.id}`}
                              aria-label={`Add task for ${role.label} in ${stage.label}`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
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

      <TaskDrawer
        task={selectedTask}
        instance={instance}
        roles={roles}
        template={template}
        skillOptions={skillOptions}
        playbookOptions={playbookOptions}
        onClose={() => { setSelectedTaskId(null); setAgentRunOpen(false); }}
        onTaskUpdate={handleTaskUpdate}
        onViewLiveRun={selectedTask?.playbook ? () => setAgentRunOpen(true) : undefined}
      />

      <AgentRunPanel
        task={agentRunOpen ? selectedTask : null}
        instance={instance}
        open={agentRunOpen}
        onClose={() => setAgentRunOpen(false)}
        onTaskUpdate={handleTaskUpdate}
      />

      {addTaskFor ? (
        <AddTaskModal
          instanceId={instance.id}
          roleId={addTaskFor.roleId}
          roleName={addTaskFor.roleName}
          stageId={addTaskFor.stageId}
          stageName={addTaskFor.stageName}
          skillOptions={skillOptions}
          playbookOptions={playbookOptions}
          onClose={() => setAddTaskFor(null)}
          onSubmit={(input) => {
            setAddTaskFor(null);
            runMutation(
              (tasks) => tasks,
              async () => {
                const result = await createTaskAction(input);
                return result.task;
              },
            );
          }}
        />
      ) : null}

      {confirmDeleteTask ? (
        <ConfirmModal
          title={`Delete "${confirmDeleteTask.title}"?`}
          description="This task and its configuration will be deleted from this instance."
          onCancel={() => setConfirmDeleteTask(null)}
          onConfirm={() => {
            const task = confirmDeleteTask;
            setConfirmDeleteTask(null);
            runMutation(
              (tasks) => tasks.filter((item) => item.id !== task.id),
              async () => {
                await deleteTaskAction(task.id);
              },
            );
          }}
        />
      ) : null}

      {isPending ? <span className="sr-only">Saving workflow edits</span> : null}
    </>
  );
}

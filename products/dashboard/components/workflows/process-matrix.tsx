"use client";

import { useCallback, useEffect, useId, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronsLeftRight, Plus } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

const matrixCollisionDetection: CollisionDetection = (args) => {
  const containers = args.droppableContainers.filter((c) =>
    String(c.id).startsWith("cell::"),
  );
  const inside = pointerWithin({ ...args, droppableContainers: containers });
  if (inside.length > 0) return inside;
  return rectIntersection({ ...args, droppableContainers: containers });
};

import {
  createTaskAction,
  deleteInstanceAction,
  deleteTaskAction,
  moveTaskAction,
  renameInstanceAction,
  updateTaskDetailsAction,
} from "@/app/(dashboard)/workflows/actions";
import { useDashboardTopBar } from "@/components/dashboard-topbar-context";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { captureError } from "@/lib/monitoring";
import { useToast } from "@/lib/toast";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";
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
import { HeaderActionsMenu } from "./header-actions-menu";
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
  const { setConfig } = useDashboardTopBar();
  const { success: toastSuccess, error: toastError } = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [addTaskFor, setAddTaskFor] = useState<{
    mode: "create" | "edit";
    taskId?: string;
    roleId: string;
    roleName: string;
    stageId: string;
    stageName: string;
    initialTask?: {
      title: string;
      description?: string;
      agent?: string | null;
      skill?: string | null;
      playbook?: string | null;
    };
  } | null>(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<WorkflowTask | null>(
    null,
  );
  const [agentRunOpen, setAgentRunOpen] = useState(false);
  const [localTasks, setLocalTasks] = useState<WorkflowTask[]>(instance.tasks);
  const [lastSavedTasks, setLastSavedTasks] = useState<WorkflowTask[]>(instance.tasks);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [isPending, startTransition] = useTransition();
  const dndContextId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Re-baseline local + saved snapshots from server props when not editing.
  // While in edit mode, the user's draft is preserved; we only re-baseline
  // after Save (or Cancel) so a parallel server revalidation (e.g. status
  // pill change in the drawer) doesn't clobber unsaved structural edits.
  useEffect(() => {
    if (editMode) return;
    setLocalTasks(instance.tasks);
    setLastSavedTasks(instance.tasks);
  }, [instance.tasks, editMode]);

  // View-mode mutations (status pills, checkpoint approvals) flow through
  // here. They reflect server truth, so update both the draft and the
  // baseline to keep `isDirty` honest.
  const handleTaskUpdate = useCallback((updated: WorkflowTask) => {
    setLocalTasks((prev) => prev.map((task) => (task.id === updated.id ? updated : task)));
    setLastSavedTasks((prev) => prev.map((task) => (task.id === updated.id ? updated : task)));
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(localTasks) !== JSON.stringify(lastSavedTasks),
    [localTasks, lastSavedTasks],
  );

  const exitEditMode = useCallback(() => {
    if (!pathname) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("edit");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const handleCancelEdit = useCallback(() => {
    if (isDirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    exitEditMode();
  }, [exitEditMode, isDirty]);

  const discardAndExit = useCallback(() => {
    setLocalTasks(lastSavedTasks);
    setConfirmDiscardOpen(false);
    exitEditMode();
  }, [exitEditMode, lastSavedTasks]);

  const handleBlockedNavigation = useCallback((proceed: () => void) => {
    setPendingNavigation(() => proceed);
  }, []);

  useUnsavedChangesGuard({
    enabled: editMode && isDirty,
    onBlock: handleBlockedNavigation,
  });

  const confirmPendingNavigation = useCallback(() => {
    const proceed = pendingNavigation;
    setPendingNavigation(null);
    if (!proceed) return;
    setLocalTasks(lastSavedTasks);
    setLastSavedTasks(lastSavedTasks);
    proceed();
  }, [lastSavedTasks, pendingNavigation]);

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

  const saveInstanceEdits = useCallback(() => {
    startTransition(async () => {
      try {
        const savedById = new Map(lastSavedTasks.map((t) => [t.id, t]));
        const draftById = new Map(localTasks.map((t) => [t.id, t]));

        const toCreate: WorkflowTask[] = [];
        const toMove: WorkflowTask[] = [];
        const toUpdate: WorkflowTask[] = [];
        const toDelete: WorkflowTask[] = [];

        for (const task of localTasks) {
          if (task.id.startsWith("local-")) {
            toCreate.push(task);
            continue;
          }
          const saved = savedById.get(task.id);
          if (!saved) continue;
          if (saved.roleId !== task.roleId || saved.stageId !== task.stageId) {
            toMove.push(task);
          }
          if (
            saved.title !== task.title ||
            saved.description !== task.description ||
            saved.agent !== task.agent ||
            saved.skill !== task.skill ||
            saved.playbook !== task.playbook
          ) {
            toUpdate.push(task);
          }
        }
        for (const saved of lastSavedTasks) {
          if (!draftById.has(saved.id)) toDelete.push(saved);
        }

        // Replay order: deletes free up cells before any creates/moves into
        // them, then creates seed new tasks at their final position, then
        // moves and detail updates apply to remaining tasks.
        const finalById = new Map<string, WorkflowTask>(
          localTasks.map((t) => [t.id, t]),
        );

        for (const task of toDelete) {
          await deleteTaskAction(task.id);
        }

        for (const task of toCreate) {
          const result = await createTaskAction({
            instanceId: instance.id,
            roleId: task.roleId,
            stageId: task.stageId,
            title: task.title,
            description: task.description,
            checkpoint: task.checkpoint,
            triggers: task.triggers,
            gates: task.gates,
            agent: task.agent,
            skill: task.skill,
            playbook: task.playbook,
          });
          finalById.delete(task.id);
          finalById.set(result.task.id, result.task);
        }

        for (const task of toMove) {
          const result = await moveTaskAction(task.id, task.roleId, task.stageId);
          finalById.set(result.task.id, result.task);
        }

        for (const task of toUpdate) {
          const result = await updateTaskDetailsAction({
            taskId: task.id,
            title: task.title,
            description: task.description,
            agent: task.agent,
            skill: task.skill,
            playbook: task.playbook,
          });
          finalById.set(result.task.id, result.task);
        }

        const finalTasks = Array.from(finalById.values());
        setLocalTasks(finalTasks);
        setLastSavedTasks(finalTasks);
        toastSuccess("Workflow saved");
        exitEditMode();
      } catch (err) {
        captureError(err, { feature: "workflows.process_matrix_save" });
        toastError(
          err instanceof Error && err.message
            ? err.message
            : "Could not save workflow changes.",
        );
      }
    });
  }, [exitEditMode, instance.id, lastSavedTasks, localTasks, toastError, toastSuccess]);

  useEffect(() => {
    setConfig({
      mode: "workflow-instance",
      crumbs: [
        { label: "Workflows" },
        { label: template?.label ?? "Workflow" },
        { label: instance.label },
      ],
      editMode,
      isDirty,
      saveDisabled: !isDirty || isPending,
      savePending: isPending,
      onSave: editMode ? saveInstanceEdits : undefined,
      onCancelEdit: editMode ? handleCancelEdit : undefined,
      actions: (
        <HeaderActionsMenu
          entityLabel={instance.label}
          entityType="instance"
          onRename={async (nextLabel) => {
            try {
              await renameInstanceAction(instance.id, nextLabel);
              toastSuccess("Instance renamed");
            } catch (err) {
              toastError(
                err instanceof Error && err.message
                  ? err.message
                  : "Could not rename the instance.",
              );
              throw err;
            }
          }}
          onDelete={async () => {
            try {
              await deleteInstanceAction(instance.id);
              toastSuccess("Instance deleted");
            } catch (err) {
              toastError(
                err instanceof Error && err.message
                  ? err.message
                  : "Could not delete the instance.",
              );
              throw err;
            }
          }}
        />
      ),
    });

    return () => setConfig(null);
  }, [
    editMode,
    handleCancelEdit,
    instance.id,
    instance.label,
    isDirty,
    isPending,
    saveInstanceEdits,
    setConfig,
    template?.label,
    toastSuccess,
    toastError,
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDragTaskId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const draggedId = String(event.active.id);
      setDragTaskId(null);
      if (!editMode) return;
      const overId = event.over?.id;
      if (typeof overId !== "string" || !overId.startsWith("cell::")) return;
      const [, targetRoleId, targetStageId] = overId.split("::");
      if (!targetRoleId || !targetStageId) return;
      const dragged = localTasks.find((t) => t.id === draggedId);
      if (!dragged) return;
      if (dragged.roleId === targetRoleId && dragged.stageId === targetStageId) return;
      const occupied = localTasks.some(
        (t) => t.roleId === targetRoleId && t.stageId === targetStageId,
      );
      if (occupied) return;

      setLocalTasks((tasks) =>
        tasks.map((item) =>
          item.id === draggedId
            ? { ...item, roleId: targetRoleId, stageId: targetStageId }
            : item,
        ),
      );
    },
    [editMode, localTasks],
  );

  const handleDragCancel = useCallback(() => {
    setDragTaskId(null);
  }, []);

  return (
    <>
      <DndContext
        id={dndContextId}
        sensors={sensors}
        collisionDetection={matrixCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
      <div
        data-testid="process-matrix"
        data-collapsed={collapsed ? "true" : "false"}
        data-dragging={dragTaskId ? "true" : undefined}
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
                    const task = tasksByCell.get(`${role.id}::${stage.id}`);

                    return (
                      <DroppableTaskCell
                        key={`${role.id}-${stage.id}`}
                        roleId={role.id}
                        stageId={stage.id}
                        hasTask={Boolean(task)}
                        editMode={editMode}
                        dragActive={Boolean(dragTaskId)}
                      >
                        {task ? (
                          <DraggableTaskCard
                            taskId={task.id}
                            disabled={!editMode}
                            isActive={dragTaskId === task.id}
                          >
                            <TaskCard
                              task={task}
                              roleColor={roleColor}
                              barState={barClass(task, canStart(task, localTasks))}
                              editMode={editMode}
                              onClick={() => setSelectedTaskId(task.id)}
                              onEdit={
                                editMode
                                  ? () =>
                                      setAddTaskFor({
                                        mode: "edit",
                                        taskId: task.id,
                                        roleId: role.id,
                                        roleName: role.label,
                                        stageId: stage.id,
                                        stageName: stage.label,
                                        initialTask: {
                                          title: task.title,
                                          description: task.description,
                                          agent: task.agent ?? null,
                                          skill: task.skill ?? null,
                                          playbook: task.playbook ?? null,
                                        },
                                      })
                                  : undefined
                              }
                              onRemove={
                                editMode ? () => setConfirmDeleteTask(task) : undefined
                              }
                            />
                          </DraggableTaskCard>
                        ) : editMode ? (
                          <div
                            className="mx-empty-cell"
                            onClick={() =>
                              setAddTaskFor({
                                mode: "create",
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
                      </DroppableTaskCell>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
      </DndContext>

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
          mode={addTaskFor.mode}
          instanceId={instance.id}
          roleId={addTaskFor.roleId}
          roleName={addTaskFor.roleName}
          stageId={addTaskFor.stageId}
          stageName={addTaskFor.stageName}
          initialTask={addTaskFor.initialTask}
          skillOptions={skillOptions}
          playbookOptions={playbookOptions}
          onClose={() => setAddTaskFor(null)}
          onSubmit={(input) => {
            const target = addTaskFor;
            setAddTaskFor(null);
            if (target.mode === "edit" && target.taskId) {
              setLocalTasks((tasks) =>
                tasks.map((task) =>
                  task.id === target.taskId
                    ? {
                        ...task,
                        title: input.title.trim(),
                        description: input.description?.trim() ?? "",
                        agent: input.agent ?? null,
                        skill: input.skill ?? null,
                        playbook: input.playbook ?? null,
                      }
                    : task,
                ),
              );
              return;
            }

            const localId = `local-${
              typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
            }`;
            const now = new Date().toISOString();
            const draftTask: WorkflowTask = {
              id: localId,
              instanceId: input.instanceId,
              roleId: input.roleId,
              stageId: input.stageId,
              title: input.title.trim(),
              description: input.description?.trim() ?? "",
              status: "not_started",
              substatus: "",
              checkpoint: Boolean(input.checkpoint),
              triggers: input.triggers ?? [],
              gates: input.gates ?? [],
              agent: input.agent ?? null,
              skill: input.skill ?? null,
              playbook: input.playbook ?? null,
              createdAt: now,
              updatedAt: now,
            };
            setLocalTasks((tasks) => [...tasks, draftTask]);
          }}
        />
      ) : null}

      {confirmDeleteTask ? (
        <ConfirmModal
          title={`Delete "${confirmDeleteTask.title}"?`}
          description="This task will be removed from the draft. The deletion is committed when you click Save."
          onCancel={() => setConfirmDeleteTask(null)}
          onConfirm={() => {
            const task = confirmDeleteTask;
            setConfirmDeleteTask(null);
            setLocalTasks((tasks) => tasks.filter((item) => item.id !== task.id));
          }}
        />
      ) : null}

      {confirmDiscardOpen ? (
        <ConfirmModal
          title="Discard unsaved changes?"
          description="Your in-progress edits to this workflow will be lost."
          onCancel={() => setConfirmDiscardOpen(false)}
          onConfirm={discardAndExit}
        />
      ) : null}

      {pendingNavigation ? (
        <ConfirmModal
          title="Discard unsaved changes?"
          description="Leaving this page will discard your in-progress edits."
          onCancel={() => setPendingNavigation(null)}
          onConfirm={confirmPendingNavigation}
        />
      ) : null}

      {isPending ? <span className="sr-only">Saving workflow edits</span> : null}
    </>
  );
}

function DraggableTaskCard({
  taskId,
  disabled,
  isActive,
  children,
}: {
  taskId: string;
  disabled: boolean;
  isActive: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: taskId,
    disabled,
  });

  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isActive ? 0.4 : undefined,
    position: isActive ? "relative" : undefined,
    zIndex: isActive ? 100 : undefined,
    touchAction: disabled ? undefined : "none",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function DroppableTaskCell({
  roleId,
  stageId,
  hasTask,
  editMode,
  dragActive,
  children,
}: {
  roleId: string;
  stageId: string;
  hasTask: boolean;
  editMode: boolean;
  dragActive: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell::${roleId}::${stageId}`,
    disabled: !editMode || hasTask,
  });

  return (
    <div
      ref={setNodeRef}
      role="cell"
      data-testid={`matrix-cell-${roleId}-${stageId}`}
      className={cn(
        "mx-task-cell",
        hasTask && "has-task",
        editMode && dragActive && !hasTask && isOver && "drag-over-cell",
      )}
    >
      {children}
    </div>
  );
}

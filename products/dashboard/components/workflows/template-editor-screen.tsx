"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { updateTemplateAction } from "@/app/(dashboard)/workflows/actions";
import { useDashboardTopBar } from "@/components/dashboard-topbar-context";
import { AddRoleModal } from "@/components/workflows/add-role-modal";
import { AddStageModal } from "@/components/workflows/add-stage-modal";
import { AddTaskModal } from "@/components/workflows/add-task-modal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useAnalytics } from "@/lib/analytics/events";
import { emitEvent } from "@/lib/events";
import { ROLE_COLORS, getRoleColor } from "@/lib/workflows/role-colors";
import type {
  FrameworkItem,
  WorkflowRole,
  WorkflowStage,
  WorkflowTask,
  WorkflowTaskTemplate,
  WorkflowTemplate,
} from "@/lib/workflows/types";
import { cn } from "@/lib/utils";

import { TaskCard } from "./task-card";

const ROLE_COLUMN_WIDTH = 172;
const STAGE_COLUMN_WIDTH = 192;
const STAGE_INSERT_WIDTH = 6;

interface TemplateEditorScreenProps {
  template: WorkflowTemplate;
  skillOptions: FrameworkItem[];
  playbookOptions: FrameworkItem[];
}

type ConfirmState =
  | null
  | {
      title: string;
      description: string;
      onConfirm: () => void;
    };

type RoleModalState =
  | null
  | {
      mode: "create" | "edit";
      index: number;
      roleId?: string;
      initialRole?: Pick<WorkflowRole, "label" | "owner">;
    };

type StageModalState =
  | null
  | {
      mode: "create" | "edit";
      index: number;
      stageId?: string;
      initialStage?: Pick<WorkflowStage, "label" | "sub">;
    };

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function templateTaskToCard(task: WorkflowTaskTemplate): WorkflowTask {
  return {
    id: task.id ?? createId("task"),
    instanceId: "template-editor",
    roleId: task.role,
    stageId: task.stage,
    title: task.title,
    description: task.desc ?? "",
    status: "not_started",
    substatus: "",
    checkpoint: Boolean(task.checkpoint),
    triggers: task.triggers ?? [],
    gates: task.gates ?? [],
    agent: task.agent ?? null,
    skill: task.skill ?? null,
    playbook: task.playbook ?? null,
    createdAt: "",
    updatedAt: "",
  };
}

function insertAt<T>(items: T[], index: number, value: T): T[] {
  return [...items.slice(0, index), value, ...items.slice(index)];
}

function ColorDot({
  color,
  onChange,
}: {
  color: string;
  onChange: (color: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      data-role-color-open={open ? "true" : "false"}
      className={cn("relative shrink-0", open && "z-30")}
    >
      <button
        type="button"
        aria-label="Change role color"
        onClick={() => setOpen((current) => !current)}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-bg-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition hover:border-border-hi hover:bg-bg-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-150"
        style={{ backgroundColor: color, boxShadow: `0 0 0 2px ${color}28` }}
      />
      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-40 grid w-[100px] grid-cols-4 gap-1 rounded-lg border border-border-hi bg-bg-3 p-2 shadow-[var(--shadow-canvas)]">
          {ROLE_COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={`Use ${swatch}`}
              onClick={() => {
                onChange(swatch);
                setOpen(false);
              }}
              className="h-4 w-4 rounded-full"
              style={{
                backgroundColor: swatch,
                outline: swatch === color ? `2px solid ${swatch}` : undefined,
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TemplateEditorScreen({
  template,
  skillOptions,
  playbookOptions,
}: TemplateEditorScreenProps) {
  const router = useRouter();
  const { setConfig } = useDashboardTopBar();
  const { capture } = useAnalytics();
  const draftRef = useRef(template);
  const [draft, setDraft] = useState<WorkflowTemplate>(template);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [roleModalState, setRoleModalState] = useState<RoleModalState>(null);
  const [stageModalState, setStageModalState] = useState<StageModalState>(null);
  const [hoveredStageInsertIndex, setHoveredStageInsertIndex] = useState<number | null>(
    null,
  );
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
  const [pending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(template);
  const rowInsertWidth = `${
    ROLE_COLUMN_WIDTH +
    draft.stages.length * STAGE_COLUMN_WIDTH +
    Math.max(draft.stages.length - 1, 0) * STAGE_INSERT_WIDTH
  }px`;

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  function addRole(role: Pick<WorkflowRole, "label" | "owner">, index: number) {
    setDraft((current) => ({
      ...current,
      roles: insertAt(current.roles, index, {
        id: createId("role"),
        label: role.label,
        owner: role.owner,
        color: ROLE_COLORS[index % ROLE_COLORS.length],
      }),
    }));
  }

  function updateRole(roleId: string, nextRole: Pick<WorkflowRole, "label" | "owner">) {
    setDraft((current) => ({
      ...current,
      roles: current.roles.map((role) =>
        role.id === roleId ? { ...role, label: nextRole.label, owner: nextRole.owner } : role,
      ),
    }));
  }

  function addStage(stage: Pick<WorkflowStage, "label" | "sub">, index: number) {
    setDraft((current) => ({
      ...current,
      stages: insertAt(current.stages, index, {
        id: createId("stage"),
        label: stage.label,
        sub: stage.sub,
      }),
    }));
  }

  function updateStage(stageId: string, nextStage: Pick<WorkflowStage, "label" | "sub">) {
    setDraft((current) => ({
      ...current,
      stages: current.stages.map((stage) =>
        stage.id === stageId ? { ...stage, label: nextStage.label, sub: nextStage.sub } : stage,
      ),
    }));
  }

  function saveTemplate() {
    setSaveError(null);
    startTransition(async () => {
      try {
        const result = await updateTemplateAction(draftRef.current.id, draftRef.current);
        setDraft(result.template);
        emitEvent("workflow.template_edited", {
          template_id: result.template.id,
          edited_by: "founder",
        });
        capture("workflow.template_edited", {
          template_id: result.template.id,
          edited_by: "founder",
        });
        router.push("/");
      } catch (error) {
        setSaveError(
          error instanceof Error && error.message
            ? error.message
            : "Could not save the workflow template.",
        );
      }
    });
  }

  useEffect(() => {
    setConfig({
      mode: "template-editor",
      label: draft.label,
      onLabelChange: (value) =>
        setDraft((current) => ({ ...current, label: value })),
      onSave: saveTemplate,
      saveDisabled: !isDirty || pending,
    });

    return () => setConfig(null);
  }, [draft.label, isDirty, pending, setConfig]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-5 py-3">
        <div className="rounded-lg border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.08)] px-3 py-2.5 text-[12px] text-[#fbbf24]">
          Modifying this workflow updates defaults for new instances. Existing
          instances keep their current tasks.
        </div>
        {saveError ? (
          <div className="mt-2 text-[11.5px] text-(color:--pill-blocked-t)">{saveError}</div>
        ) : null}
      </div>

      <div className="matrix-wrap flex-1 overflow-auto">
        <div className="matrix inline-block min-w-full">
          <div className="matrix-head-row" role="row">
            <div className="mx-corner" role="columnheader">
              <span className="flex-1">Roles</span>
            </div>

            {draft.stages.map((stage, index) => (
              <div key={stage.id} className="contents">
                <div className="mx-stage-hd" role="columnheader">
                  <div className="mx-entity-content">
                    <div className="min-w-0">
                      <div className="mx-stage-name">{stage.label}</div>
                      <div className="mx-stage-sub mx-stage-sub-plain">
                        {stage.sub?.trim() || "No description"}
                      </div>
                    </div>
                    <div className="mx-entity-actions mx-entity-actions-group">
                      <button
                        type="button"
                        aria-label={`Edit stage ${stage.label}`}
                        className="mx-entity-action"
                        onClick={() =>
                          setStageModalState({
                            mode: "edit",
                            index,
                            stageId: stage.id,
                            initialStage: { label: stage.label, sub: stage.sub },
                          })
                        }
                      >
                        <Pencil className="h-[11px] w-[11px]" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove stage ${stage.label}`}
                        className="mx-entity-action mx-entity-action-danger"
                        onClick={() =>
                          setConfirmState({
                            title: `Remove stage "${stage.label}"?`,
                            description: "All tasks in this stage will be removed.",
                            onConfirm: () => {
                              setDraft((current) => ({
                                ...current,
                                stages: current.stages.filter((item) => item.id !== stage.id),
                                taskTemplates: current.taskTemplates.filter(
                                  (task) => task.stage !== stage.id,
                                ),
                              }));
                              setConfirmState(null);
                            },
                          })
                        }
                      >
                        <Trash2 className="h-[11px] w-[11px]" />
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className={cn(
                    "mx-col-insert",
                    hoveredStageInsertIndex === index + 1 && "mx-col-insert-active",
                  )}
                  onMouseEnter={() => setHoveredStageInsertIndex(index + 1)}
                  onMouseLeave={() => setHoveredStageInsertIndex((current) =>
                    current === index + 1 ? null : current,
                  )}
                  onClick={() =>
                    setStageModalState({
                      mode: "create",
                      index: index + 1,
                    })
                  }
                >
                  <span className="mx-col-insert-icon">
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                </button>
              </div>
            ))}
          </div>

          {draft.roles.map((role, roleIndex) => (
            <div key={role.id} className="contents">
              <div className="mx-body-row" role="row">
                <div className="mx-role-cell" role="rowheader">
                  <ColorDot
                    color={role.color || getRoleColor(role.id, draft.roles)}
                    onChange={(color) =>
                      setDraft((current) => ({
                        ...current,
                        roles: current.roles.map((item) =>
                          item.id === role.id ? { ...item, color } : item,
                        ),
                      }))
                    }
                  />
                  <div className="mx-entity-content">
                    <div className="min-w-0">
                      <div className="mx-role-name">{role.label}</div>
                      <div className="mx-role-owner mx-role-owner-plain">
                        {role.owner?.trim() || "No owner"}
                      </div>
                    </div>
                    <div className="mx-entity-actions mx-entity-actions-group">
                      <button
                        type="button"
                        className="mx-entity-action"
                        aria-label={`Edit role ${role.label}`}
                        onClick={() =>
                          setRoleModalState({
                            mode: "edit",
                            index: roleIndex,
                            roleId: role.id,
                            initialRole: { label: role.label, owner: role.owner },
                          })
                        }
                      >
                        <Pencil className="h-[11px] w-[11px]" />
                      </button>
                      <button
                        type="button"
                        className="mx-entity-action mx-entity-action-danger"
                        aria-label={`Remove role ${role.label}`}
                        onClick={() =>
                          setConfirmState({
                            title: `Remove role "${role.label}"?`,
                            description:
                              "All tasks assigned to this role in this template will be removed.",
                            onConfirm: () => {
                              setDraft((current) => ({
                                ...current,
                                roles: current.roles.filter((item) => item.id !== role.id),
                                taskTemplates: current.taskTemplates.filter(
                                  (task) => task.role !== role.id,
                                ),
                              }));
                              setConfirmState(null);
                            },
                          })
                        }
                      >
                        <Trash2 className="h-[11px] w-[11px]" />
                      </button>
                    </div>
                  </div>
                </div>

                {draft.stages.map((stage) => {
                  const templateTask = draft.taskTemplates.find(
                    (task) => task.role === role.id && task.stage === stage.id,
                  );
                  const task = templateTask ? templateTaskToCard(templateTask) : null;
                  const insertIndex = draft.stages.findIndex((item) => item.id === stage.id) + 1;

                  return (
                    <div key={`${role.id}-${stage.id}`} className="contents">
                      <div className="mx-task-cell">
                        {task ? (
                          <TaskCard
                            task={task}
                            roleColor={role.color || getRoleColor(role.id, draft.roles)}
                            barState="bar-ready"
                            editMode
                            showDefaultPill
                            onEdit={() =>
                              setAddTaskFor({
                                mode: "edit",
                                taskId: templateTask?.id,
                                roleId: role.id,
                                roleName: role.label,
                                stageId: stage.id,
                                stageName: stage.label,
                                initialTask: {
                                  title: templateTask?.title ?? "",
                                  description: templateTask?.desc ?? "",
                                  agent: templateTask?.agent ?? null,
                                  skill: templateTask?.skill ?? null,
                                  playbook: templateTask?.playbook ?? null,
                                },
                              })
                            }
                            onRemove={() =>
                              setConfirmState({
                                title: `Delete "${task.title}"?`,
                                description:
                                  "This task and its default configuration will be removed from the template.",
                                onConfirm: () => {
                                  setDraft((current) => ({
                                    ...current,
                                    taskTemplates: current.taskTemplates.filter(
                                      (item) => item.id !== templateTask?.id,
                                    ),
                                  }));
                                  setConfirmState(null);
                                },
                              })
                            }
                          />
                        ) : (
                          <button
                            type="button"
                            data-testid={`matrix-add-task-${role.id}-${stage.id}`}
                            onClick={() =>
                              setAddTaskFor({
                                mode: "create",
                                roleId: role.id,
                                roleName: role.label,
                                stageId: stage.id,
                                stageName: stage.label,
                              })
                            }
                            className="mx-empty-cell w-full"
                          >
                            <span className="mx-add-btn">
                              <Plus className="h-3.5 w-3.5" />
                            </span>
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label={`Insert stage after ${stage.label}`}
                        className={cn(
                          "mx-col-insert-body",
                          hoveredStageInsertIndex === insertIndex && "mx-col-insert-active",
                        )}
                        onMouseEnter={() => setHoveredStageInsertIndex(insertIndex)}
                        onMouseLeave={() => setHoveredStageInsertIndex((current) =>
                          current === insertIndex ? null : current,
                        )}
                        onClick={() =>
                          setStageModalState({
                            mode: "create",
                            index: insertIndex,
                          })
                        }
                      />
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                className="mx-row-insert"
                data-testid={`matrix-insert-role-${roleIndex + 1}`}
                style={{ width: rowInsertWidth }}
                onClick={() =>
                  setRoleModalState({
                    mode: "create",
                    index: roleIndex + 1,
                  })
                }
              >
                <span className="mx-row-insert-label">
                  <Plus className="h-3 w-3" />
                </span>
              </button>
            </div>
          ))}

          <button
            type="button"
            className="mx-row-insert"
            data-testid="matrix-insert-role-end"
            style={{ width: rowInsertWidth }}
            onClick={() =>
              setRoleModalState({
                mode: "create",
                index: draft.roles.length,
              })
            }
          >
            <span className="mx-row-insert-label">
              <Plus className="h-3 w-3" />
            </span>
          </button>
        </div>
      </div>

      {roleModalState ? (
        <AddRoleModal
          mode={roleModalState.mode}
          initialRole={roleModalState.initialRole}
          onClose={() => setRoleModalState(null)}
          onSubmit={(role) => {
            if (roleModalState.mode === "edit" && roleModalState.roleId) {
              updateRole(roleModalState.roleId, role);
              return;
            }
            addRole(role, roleModalState.index);
          }}
        />
      ) : null}

      {stageModalState ? (
        <AddStageModal
          mode={stageModalState.mode}
          initialStage={stageModalState.initialStage}
          onClose={() => setStageModalState(null)}
          onSubmit={(stage) => {
            if (stageModalState.mode === "edit" && stageModalState.stageId) {
              updateStage(stageModalState.stageId, stage);
              return;
            }
            addStage(stage, stageModalState.index);
          }}
        />
      ) : null}

      {addTaskFor ? (
        <AddTaskModal
          mode={addTaskFor.mode}
          instanceId={`template:${draft.id}`}
          roleId={addTaskFor.roleId}
          roleName={addTaskFor.roleName}
          stageId={addTaskFor.stageId}
          stageName={addTaskFor.stageName}
          initialTask={addTaskFor.initialTask}
          skillOptions={skillOptions}
          playbookOptions={playbookOptions}
          onClose={() => setAddTaskFor(null)}
          onSubmit={(input) => {
            setDraft((current) => {
              if (addTaskFor.mode === "edit" && addTaskFor.taskId) {
                return {
                  ...current,
                  taskTemplates: current.taskTemplates.map((item) =>
                    item.id === addTaskFor.taskId
                      ? {
                          ...item,
                          title: input.title.trim(),
                          desc: input.description?.trim(),
                          agent: input.agent ?? undefined,
                          skill: input.skill ?? undefined,
                          playbook: input.playbook ?? undefined,
                        }
                      : item,
                  ),
                };
              }

              return {
                ...current,
                taskTemplates: [
                  ...current.taskTemplates,
                  {
                    id: createId("task"),
                    role: input.roleId,
                    stage: input.stageId,
                    title: input.title.trim(),
                    desc: input.description?.trim(),
                    checkpoint: Boolean(input.checkpoint),
                    triggers: input.triggers ?? [],
                    gates: input.gates ?? [],
                    agent: input.agent ?? undefined,
                    skill: input.skill ?? undefined,
                    playbook: input.playbook ?? undefined,
                  },
                ],
              };
            });
            setAddTaskFor(null);
          }}
        />
      ) : null}

      {confirmState ? (
        <ConfirmModal
          title={confirmState.title}
          description={confirmState.description}
          onCancel={() => setConfirmState(null)}
          onConfirm={confirmState.onConfirm}
        />
      ) : null}
    </div>
  );
}

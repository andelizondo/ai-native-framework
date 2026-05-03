"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { CircleAlert, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { ColorDotPicker } from "@/components/framework/color-dot-picker";
import { ItemAvatar } from "@/components/framework/item-avatar";
import { OwnerPicker } from "@/components/framework/owner-picker";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
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
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  deleteTemplateAction,
  renameTemplateAction,
  updateTemplateAction,
} from "@/app/(dashboard)/workflows/actions";
import { useDashboardTopBar } from "@/components/dashboard-topbar-context";
import { useToast } from "@/lib/toast";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";
import { AddSkillModal } from "@/components/workflows/add-skill-modal";
import { AddStageModal } from "@/components/workflows/add-stage-modal";
import { AddPlaybookModal } from "@/components/workflows/add-playbook-modal";
import { HeaderActionsMenu } from "@/components/workflows/header-actions-menu";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useAnalytics } from "@/lib/analytics/events";
import { emitEvent } from "@/lib/events";
import { resolveSkillColor } from "@/lib/workflows/skill-colors";
import type {
  FrameworkItem,
  WorkflowSkill,
  WorkflowStage,
  WorkflowTask,
  WorkflowTaskTemplate,
  WorkflowTemplate,
} from "@/lib/workflows/types";
import { cn } from "@/lib/utils";

import { TaskCard } from "./task-card";

interface TemplateEditorScreenProps {
  template: WorkflowTemplate;
  instanceCount: number;
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

type SkillModalState =
  | null
  | {
      mode: "create" | "edit";
      index: number;
      skillId?: string;
      initialSkill?: Pick<WorkflowSkill, "id" | "label" | "owners">;
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

function withStableTaskIds(template: WorkflowTemplate): WorkflowTemplate {
  let mutated = false;
  const taskTemplates = template.taskTemplates.map((task) => {
    if (task.id) return task;
    mutated = true;
    return { ...task, id: `task-seed-${task.skillId}-${task.stageId}` };
  });
  return mutated ? { ...template, taskTemplates } : template;
}

function templateTaskToCard(task: WorkflowTaskTemplate): WorkflowTask {
  return {
    id: task.id ?? createId("task"),
    instanceId: "template-editor",
    skillId: task.skillId,
    stageId: task.stageId,
    notes: task.notes ?? "",
    status: "not_started",
    substatus: "",
    checkpoint: Boolean(task.checkpoint),
    triggers: task.triggers ?? [],
    gates: task.gates ?? [],
    playbookId: task.playbookId ?? null,
    createdAt: "",
    updatedAt: "",
  };
}

function insertAt<T>(items: T[], index: number, value: T): T[] {
  return [...items.slice(0, index), value, ...items.slice(index)];
}

function blurActiveElement() {
  if (typeof document === "undefined") return;
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
}

const matrixCollisionDetection: CollisionDetection = (args) => {
  const activeId = String(args.active.id);
  const containers = args.droppableContainers.filter((c) => {
    const id = String(c.id);
    if (activeId.startsWith("task::")) return id.startsWith("cell::");
    if (activeId.startsWith("stage::")) return id.startsWith("stage::");
    if (activeId.startsWith("skill::")) return id.startsWith("skill::");
    return true;
  });

  if (activeId.startsWith("task::")) {
    const inside = pointerWithin({ ...args, droppableContainers: containers });
    if (inside.length > 0) return inside;
    return rectIntersection({ ...args, droppableContainers: containers });
  }

  return closestCenter({ ...args, droppableContainers: containers });
};

function SortableMatrixItem({
  id,
  className,
  role,
  children,
  testId,
}: {
  id: string;
  className?: string;
  role?: string;
  testId?: string;
  children: (args: {
    handleProps: {
      ref: (node: HTMLElement | null) => void;
      attributes: Record<string, unknown>;
      listeners: Record<string, unknown>;
    };
    isDragging: boolean;
  }) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      role={role}
      data-testid={testId}
      className={cn(className, isDragging && "mx-dragging")}
      style={style}
    >
      {children({
        handleProps: {
          ref: setActivatorNodeRef,
          attributes: attributes as unknown as Record<string, unknown>,
          listeners: (listeners ?? {}) as unknown as Record<string, unknown>,
        },
        isDragging,
      })}
    </div>
  );
}

function DragHandle({
  handleProps,
  ariaLabel,
}: {
  handleProps: {
    ref: (node: HTMLElement | null) => void;
    attributes: Record<string, unknown>;
    listeners: Record<string, unknown>;
  };
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      ref={handleProps.ref as unknown as React.Ref<HTMLButtonElement>}
      aria-label={ariaLabel}
      className="mx-drag-handle"
      {...handleProps.attributes}
      {...handleProps.listeners}
    >
      <GripVertical aria-hidden className="h-3 w-3" />
    </button>
  );
}

function MatrixHeaderInsertButton({
  axis,
  ariaLabel,
  onClick,
}: {
  axis: "column" | "row";
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        "mx-header-insert-zone",
        axis === "column" ? "mx-header-insert-column" : "mx-header-insert-row",
      )}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        className="mx-header-insert"
        onClick={onClick}
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

export function TemplateEditorScreen({
  template,
  instanceCount,
  skillOptions,
  playbookOptions,
}: TemplateEditorScreenProps) {
  const { setConfig } = useDashboardTopBar();
  const { capture } = useAnalytics();
  const { success: toastSuccess, error: toastError } = useToast();
  const draftRef = useRef(template);
  const [lastSaved, setLastSaved] = useState<WorkflowTemplate>(template);
  const [draft, setDraft] = useState<WorkflowTemplate>(() => withStableTaskIds(template));
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [skillModalState, setSkillModalState] = useState<SkillModalState>(null);
  const [stageModalState, setStageModalState] = useState<StageModalState>(null);
  const [addTaskFor, setAddTaskFor] = useState<{
    mode: "create" | "edit";
    taskId?: string;
    skillId: string;
    skillLabel: string;
    stageId: string;
    stageName: string;
    initial?: {
      playbookId?: string | null;
      notes?: string;
    };
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const dndContextId = useId();

  const playbookById = useMemo(
    () => new Map(playbookOptions.map((pb) => [pb.id, pb])),
    [playbookOptions],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [dragTaskId, setDragTaskId] = useState<string | null>(null);

  const dragAllowedSkillIds = useMemo<Set<string> | null>(() => {
    if (!dragTaskId?.startsWith("task::")) return null;
    const id = dragTaskId.slice("task::".length);
    const dragged = draft.taskTemplates.find((t) => t.id === id);
    if (!dragged?.playbookId) return null;
    const playbook = playbookById.get(dragged.playbookId);
    if (!playbook) return null;
    return new Set([dragged.skillId, ...(playbook.allowedSkillIds ?? [])]);
  }, [dragTaskId, draft.taskTemplates, playbookById]);

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    if (id.startsWith("task::")) setDragTaskId(id);
  }

  function handleDragCancel() {
    setDragTaskId(null);
    blurActiveElement();
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const activeId = String(active.id);
    setDragTaskId(null);
    // dnd-kit leaves the activator focused, which keeps the floating drag
    // chip visible after drop. Blurring releases the focus so it fades back.
    blurActiveElement();

    if (activeId.startsWith("stage::")) {
      if (!over || active.id === over.id) return;
      const fromId = activeId.slice("stage::".length);
      const toId = String(over.id).slice("stage::".length);
      setDraft((current) => {
        const from = current.stages.findIndex((s) => s.id === fromId);
        const to = current.stages.findIndex((s) => s.id === toId);
        if (from < 0 || to < 0) return current;
        return { ...current, stages: arrayMove(current.stages, from, to) };
      });
      return;
    }

    if (activeId.startsWith("skill::")) {
      if (!over || active.id === over.id) return;
      const fromId = activeId.slice("skill::".length);
      const toId = String(over.id).slice("skill::".length);
      setDraft((current) => {
        const from = current.skills.findIndex((r) => r.id === fromId);
        const to = current.skills.findIndex((r) => r.id === toId);
        if (from < 0 || to < 0) return current;
        return { ...current, skills: arrayMove(current.skills, from, to) };
      });
      return;
    }

    if (activeId.startsWith("task::")) {
      const overId = over?.id;
      if (typeof overId !== "string" || !overId.startsWith("cell::")) return;
      const [, targetSkillId, targetStageId] = overId.split("::");
      if (!targetSkillId || !targetStageId) return;
      const taskId = activeId.slice("task::".length);
      setDraft((current) => {
        const occupied = current.taskTemplates.some(
          (t) => t.skillId === targetSkillId && t.stageId === targetStageId,
        );
        if (occupied) return current;
        const dragged = current.taskTemplates.find((t) => t.id === taskId);
        if (!dragged) return current;
        if (dragged.skillId !== targetSkillId && dragged.playbookId) {
          const playbook = playbookById.get(dragged.playbookId);
          if (playbook && !(playbook.allowedSkillIds ?? []).includes(targetSkillId)) {
            return current;
          }
        }
        return {
          ...current,
          taskTemplates: current.taskTemplates.map((task) =>
            task.id === taskId
              ? { ...task, skillId: targetSkillId, stageId: targetStageId }
              : task,
          ),
        };
      });
    }
  }

  const isDirty = JSON.stringify(draft) !== JSON.stringify(lastSaved);

  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  const handleBlockedNavigation = useCallback((proceed: () => void) => {
    setPendingNavigation(() => proceed);
  }, []);

  useUnsavedChangesGuard({
    enabled: isDirty,
    onBlock: handleBlockedNavigation,
  });

  const confirmPendingNavigation = useCallback(() => {
    const proceed = pendingNavigation;
    setPendingNavigation(null);
    if (!proceed) return;
    setDraft(lastSaved);
    proceed();
  }, [lastSaved, pendingNavigation]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    setDraft(withStableTaskIds(template));
    setLastSaved(template);
  }, [template]);

  function addSkill(skill: Pick<WorkflowSkill, "id" | "label" | "owners">, index: number) {
    setDraft((current) => ({
      ...current,
      skills: insertAt(current.skills, index, {
        id: skill.id,
        label: skill.label,
        owners: skill.owners,
      }),
    }));
  }

  function updateSkill(skillId: string, next: Pick<WorkflowSkill, "id" | "label" | "owners">) {
    setDraft((current) => ({
      ...current,
      skills: current.skills.map((skill) =>
        skill.id === skillId
          ? { ...skill, id: next.id, label: next.label, owners: next.owners }
          : skill,
      ),
      taskTemplates:
        next.id === skillId
          ? current.taskTemplates
          : current.taskTemplates.map((t) =>
              t.skillId === skillId ? { ...t, skillId: next.id } : t,
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
    startTransition(async () => {
      try {
        const result = await updateTemplateAction(draftRef.current.id, draftRef.current);
        setDraft(result.template);
        setLastSaved(result.template);
        emitEvent("workflow.template_edited", {
          template_id: result.template.id,
          edited_by: "founder",
        });
        capture("workflow.template_edited", {
          template_id: result.template.id,
          edited_by: "founder",
        });
        toastSuccess("Template saved");
      } catch (err) {
        toastError(
          err instanceof Error && err.message
            ? err.message
            : "Could not save the workflow template.",
        );
      }
    });
  }

  useEffect(() => {
    setConfig({
      mode: "template-editor",
      crumbs: [{ label: "Workflows" }, { label: draft.label }],
      label: draft.label,
      onLabelChange: (value) =>
        setDraft((current) => ({ ...current, label: value })),
      onSave: saveTemplate,
      saveDisabled: !isDirty || pending,
      savePending: pending,
      actions: (
        <HeaderActionsMenu
          entityLabel={draft.label}
          entityType="template"
          onRename={async (nextLabel) => {
            try {
              const result = await renameTemplateAction(draft.id, nextLabel);
              setDraft((current) => ({ ...current, label: result.template.label }));
              setLastSaved((current) => ({ ...current, label: result.template.label }));
              toastSuccess("Template renamed");
            } catch (err) {
              toastError(
                err instanceof Error && err.message
                  ? err.message
                  : "Could not rename the template.",
              );
              throw err;
            }
          }}
          onDelete={async () => {
            try {
              await deleteTemplateAction(draft.id);
              toastSuccess("Template deleted");
            } catch (err) {
              toastError(
                err instanceof Error && err.message
                  ? err.message
                  : "Could not delete the template.",
              );
              throw err;
            }
          }}
          requireDeleteLabelMatch
          deleteDescription={
            <>
              This will permanently delete the workflow template.
              <strong className="font-semibold text-t1">
                {" "}
                It will also delete all {instanceCount} associated{" "}
                {instanceCount === 1 ? "instance" : "instances"}.
              </strong>{" "}
              Type &quot;{draft.label}&quot; to confirm.
            </>
          }
        />
      ),
    });

    return () => setConfig(null);
  }, [draft.label, isDirty, pending, setConfig, toastSuccess, toastError]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border bg-bg px-6 py-4">
        <div className="min-w-0">
            <div className="flex items-center gap-1.5 leading-none">
              <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-t3">
                Workflow template
              </p>
              <div className="group relative inline-flex items-center">
                <button
                  type="button"
                  aria-label="Template editing information"
                  aria-describedby="template-editor-help"
                  className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center text-[#fbbf24] transition hover:text-[#fcd34d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fbbf24]"
                >
                  <CircleAlert className="h-3 w-3" />
                </button>
                <div
                  id="template-editor-help"
                  role="tooltip"
                  className="pointer-events-none absolute left-0 top-[calc(100%+8px)] z-30 hidden w-[280px] rounded-lg border border-[rgba(245,158,11,0.28)] bg-bg-2 px-3 py-2 text-[12px] leading-5 text-[#fbbf24] shadow-[var(--shadow-canvas)] group-hover:block group-focus-within:block"
                >
                  Modifying this workflow updates defaults for new instances. Existing
                  instances keep their current tasks.
                </div>
              </div>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="truncate text-[20px] font-bold tracking-tight text-t1">{draft.label}</h1>
              <ColorDotPicker
                color={draft.color}
                ariaLabel="Change workflow template color"
                onChange={(nextColor) =>
                  setDraft((current) => ({ ...current, color: nextColor }))
                }
              />
            </div>
            <p className="mt-1 text-[13px] text-t2">
              {draft.taskTemplates.length}{" "}
              {draft.taskTemplates.length === 1 ? "playbook" : "playbooks"} ·{" "}
              {draft.skills.length} {draft.skills.length === 1 ? "skill" : "skills"} ·{" "}
              {draft.stages.length} {draft.stages.length === 1 ? "stage" : "stages"}
            </p>
        </div>
      </div>

      <div
        className="matrix-wrap flex-1 overflow-auto"
        data-dragging={dragTaskId ? "true" : undefined}
      >
        <DndContext
          id={dndContextId}
          sensors={sensors}
          collisionDetection={matrixCollisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
        <div className="matrix inline-block min-w-full">
          <div className="matrix-head-row" role="row">
            <div className="mx-corner" role="columnheader">
              <span className="flex-1">Skills</span>
            </div>

            {draft.stages.length === 0 ? (
              <div className="mx-stage-hd" role="columnheader">
                <button
                  type="button"
                  className="mx-empty-state-btn"
                  onClick={() =>
                    setStageModalState({
                      mode: "create",
                      index: 0,
                    })
                  }
                >
                  Add first stage
                </button>
              </div>
            ) : null}
            <SortableContext
                items={draft.stages.map((s) => `stage::${s.id}`)}
                strategy={horizontalListSortingStrategy}
              >
                {draft.stages.map((stage, index) => (
                  <SortableMatrixItem
                    key={stage.id}
                    id={`stage::${stage.id}`}
                    role="columnheader"
                    className="mx-stage-hd"
                  >
                    {({ handleProps }) => (
                      <>
                        <div className="mx-entity-content">
                          <div className="min-w-0 flex items-center gap-1.5">
                            <DragHandle
                              handleProps={handleProps}
                              ariaLabel={`Reorder stage ${stage.label}`}
                            />
                            <div className="min-w-0">
                              <div className="mx-stage-name">{stage.label}</div>
                              <div className="mx-stage-sub mx-stage-sub-plain">
                                {stage.sub?.trim() || "No description"}
                              </div>
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
                                  description: "All playbooks in this stage will be removed.",
                                  onConfirm: () => {
                                    setDraft((current) => ({
                                      ...current,
                                      stages: current.stages.filter((item) => item.id !== stage.id),
                                      taskTemplates: current.taskTemplates.filter(
                                        (task) => task.stageId !== stage.id,
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
                        {index < draft.stages.length - 1 ? (
                          <MatrixHeaderInsertButton
                            axis="column"
                            ariaLabel={`Add stage after ${stage.label}`}
                            onClick={() =>
                              setStageModalState({
                                mode: "create",
                                index: index + 1,
                              })
                            }
                          />
                        ) : null}
                        {index === draft.stages.length - 1 ? (
                          <MatrixHeaderInsertButton
                            axis="column"
                            ariaLabel={`Add stage after ${stage.label}`}
                            onClick={() =>
                              setStageModalState({
                                mode: "create",
                                index: draft.stages.length,
                              })
                            }
                          />
                        ) : null}
                      </>
                    )}
                  </SortableMatrixItem>
                ))}
              </SortableContext>
          </div>

          {draft.skills.length === 0 ? (
            <div className="mx-body-row" role="row">
              <div className="mx-role-cell" role="rowheader">
                <button
                  type="button"
                  className="mx-empty-state-btn"
                  onClick={() =>
                    setSkillModalState({
                      mode: "create",
                      index: 0,
                    })
                  }
                >
                  Add first skill
                </button>
              </div>
              {draft.stages.map((stage) => (
                <div key={`empty-skill-${stage.id}`} className="mx-task-cell" />
              ))}
            </div>
          ) : null}
          <SortableContext
              items={draft.skills.map((r) => `skill::${r.id}`)}
              strategy={verticalListSortingStrategy}
            >
              {draft.skills.map((skill, skillIndex) => (
                <SortableMatrixItem
                  key={skill.id}
                  id={`skill::${skill.id}`}
                  role="row"
                  className="mx-body-row"
                >
                  {({ handleProps }) => (
                    <>
                      <div className="mx-role-cell" role="rowheader">
                        <DragHandle
                          handleProps={handleProps}
                          ariaLabel={`Reorder skill ${skill.label}`}
                        />
                        {(() => {
                          const frameworkSkill = skillOptions.find(
                            (item) => item.id === skill.id,
                          );
                          return (
                            <ItemAvatar
                              emoji={frameworkSkill?.icon ?? "•"}
                              color={resolveSkillColor(skill.id, skillOptions)}
                              label={skill.label}
                              size="sm"
                            />
                          );
                        })()}
                        <div className="mx-entity-content">
                          <div className="min-w-0">
                            <div className="mx-role-name">{skill.label}</div>
                            <div className="mx-role-owner mx-role-owner-plain">
                              <OwnerPicker
                                values={skill.owners}
                                onChange={(nextOwners) =>
                                  setDraft((current) => ({
                                    ...current,
                                    skills: current.skills.map((item) =>
                                      item.id === skill.id
                                        ? { ...item, owners: nextOwners }
                                        : item,
                                    ),
                                  }))
                                }
                                required
                                placeholder="Pick owners"
                                ariaLabel={`Change owners for ${skill.label}`}
                              />
                            </div>
                          </div>
                          <div className="mx-entity-actions mx-entity-actions-group">
                            <button
                              type="button"
                              className="mx-entity-action mx-entity-action-danger"
                              aria-label={`Remove skill ${skill.label}`}
                              onClick={() =>
                                setConfirmState({
                                  title: `Remove skill "${skill.label}"?`,
                                  description:
                                    "All playbooks assigned to this skill in this template will be removed.",
                                  onConfirm: () => {
                                    setDraft((current) => ({
                                      ...current,
                                      skills: current.skills.filter((item) => item.id !== skill.id),
                                      taskTemplates: current.taskTemplates.filter(
                                        (task) => task.skillId !== skill.id,
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
                        {skillIndex < draft.skills.length - 1 ? (
                          <MatrixHeaderInsertButton
                            axis="row"
                            ariaLabel={`Add skill after ${skill.label}`}
                            onClick={() =>
                              setSkillModalState({
                                mode: "create",
                                index: skillIndex + 1,
                              })
                            }
                          />
                        ) : null}
                        {skillIndex === draft.skills.length - 1 ? (
                          <MatrixHeaderInsertButton
                            axis="row"
                            ariaLabel={`Add skill after ${skill.label}`}
                            onClick={() =>
                              setSkillModalState({
                                mode: "create",
                                index: draft.skills.length,
                              })
                            }
                          />
                        ) : null}
                      </div>

                      {draft.stages.map((stage) => {
                const templateTask = draft.taskTemplates.find(
                  (task) => task.skillId === skill.id && task.stageId === stage.id,
                );
                const task = templateTask ? templateTaskToCard(templateTask) : null;
                const playbook = templateTask?.playbookId
                  ? playbookById.get(templateTask.playbookId) ?? null
                  : null;

                return (
                  <DroppableTemplateCell
                    key={`${skill.id}-${stage.id}`}
                    skillId={skill.id}
                    stageId={stage.id}
                    hasTask={Boolean(task)}
                    dragActive={Boolean(dragTaskId)}
                    dropAllowed={
                      dragAllowedSkillIds === null ||
                      dragAllowedSkillIds.has(skill.id)
                    }
                  >
                    {task && templateTask ? (
                      <DraggableTemplateTask
                        taskId={`task::${templateTask.id ?? task.id}`}
                        isActive={dragTaskId === `task::${templateTask.id ?? task.id}`}
                      >
                        <TaskCard
                          task={task}
                          playbook={playbook}
                          skillColor={resolveSkillColor(skill.id, skillOptions)}
                          barState="bar-ready"
                          editMode
                          hideStatusPill
                          onEdit={() =>
                            setAddTaskFor({
                              mode: "edit",
                              taskId: templateTask.id,
                              skillId: skill.id,
                              skillLabel: skill.label,
                              stageId: stage.id,
                              stageName: stage.label,
                              initial: {
                                playbookId: templateTask.playbookId ?? null,
                                notes: templateTask.notes ?? "",
                              },
                            })
                          }
                          onRemove={() =>
                            setConfirmState({
                              title: `Delete playbook?`,
                              description:
                                "This playbook and its default configuration will be removed from the template.",
                              onConfirm: () => {
                                setDraft((current) => ({
                                  ...current,
                                  taskTemplates: current.taskTemplates.filter(
                                    (item) => item.id !== templateTask.id,
                                  ),
                                }));
                                setConfirmState(null);
                              },
                            })
                          }
                        />
                      </DraggableTemplateTask>
                    ) : (
                      <div
                        className="mx-empty-cell"
                        onClick={() =>
                          setAddTaskFor({
                            mode: "create",
                            skillId: skill.id,
                            skillLabel: skill.label,
                            stageId: stage.id,
                            stageName: stage.label,
                          })
                        }
                      >
                        <button
                          type="button"
                          className="mx-add-btn"
                          data-testid={`matrix-add-task-${skill.id}-${stage.id}`}
                          aria-label={`Add task for ${skill.label} in ${stage.label}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </DroppableTemplateCell>
                );
                      })}
                    </>
                  )}
                </SortableMatrixItem>
              ))}
            </SortableContext>
        </div>
        </DndContext>
      </div>

      {skillModalState ? (
        <AddSkillModal
          mode={skillModalState.mode}
          initialSkill={skillModalState.initialSkill}
          skills={skillOptions}
          alreadyUsedIds={draft.skills.map((s) => s.id)}
          onClose={() => setSkillModalState(null)}
          onSubmit={(skill) => {
            if (skillModalState.mode === "edit" && skillModalState.skillId) {
              updateSkill(skillModalState.skillId, skill);
              return;
            }
            addSkill(skill, skillModalState.index);
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
        <AddPlaybookModal
          mode={addTaskFor.mode}
          skillId={addTaskFor.skillId}
          skillLabel={addTaskFor.skillLabel}
          stageId={addTaskFor.stageId}
          stageName={addTaskFor.stageName}
          playbooks={playbookOptions}
          initial={addTaskFor.initial}
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
                          playbookId: input.playbookId,
                          notes: input.notes,
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
                    skillId: addTaskFor.skillId,
                    stageId: addTaskFor.stageId,
                    playbookId: input.playbookId,
                    notes: input.notes,
                    triggers: [],
                    gates: [],
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

      {pendingNavigation ? (
        <ConfirmModal
          title="Discard unsaved changes?"
          description="Leaving this page will discard your in-progress edits."
          confirmLabel="Discard"
          onCancel={() => setPendingNavigation(null)}
          onConfirm={confirmPendingNavigation}
        />
      ) : null}
    </div>
  );
}

function DraggableTemplateTask({
  taskId,
  isActive,
  children,
}: {
  taskId: string;
  isActive: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: taskId,
  });

  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isActive ? 0.4 : undefined,
    position: isActive ? "relative" : undefined,
    zIndex: isActive ? 100 : undefined,
    touchAction: "none",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function DroppableTemplateCell({
  skillId,
  stageId,
  hasTask,
  dragActive,
  dropAllowed,
  children,
}: {
  skillId: string;
  stageId: string;
  hasTask: boolean;
  dragActive: boolean;
  dropAllowed: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell::${skillId}::${stageId}`,
    disabled: hasTask || !dropAllowed,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mx-task-cell",
        hasTask && "has-task",
        dragActive && !hasTask && dropAllowed && isOver && "drag-over-cell",
        dragActive && !hasTask && !dropAllowed && "drag-disallowed-cell",
      )}
    >
      {children}
    </div>
  );
}

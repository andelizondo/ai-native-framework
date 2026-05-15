"use client";

import { X } from "lucide-react";

import { resolveSkillColor } from "@/lib/workflows/skill-colors";
import type {
  FrameworkItem,
  WorkflowInstanceDetail,
  WorkflowSkill,
  WorkflowTask,
  WorkflowTaskStatus,
} from "@/lib/workflows/types";

export type HeaderBarVariant = "active" | "pending" | "blocked" | null;

export const STATUS_BAR_VARIANT: Record<WorkflowTaskStatus, HeaderBarVariant> = {
  not_started: null,
  waiting: "pending",
  paused: "blocked",
  in_progress: "active",
  running: "active",
  complete: null,
  failed: "blocked",
};

export interface DrawerHeaderProps {
  task: WorkflowTask;
  instance: WorkflowInstanceDetail;
  skills: WorkflowSkill[];
  playbookOptions: FrameworkItem[];
  /** Framework skill catalog — has the user-chosen color. Falls back to
   *  the instance skill snapshot when the framework skill was removed. */
  frameworkSkills?: FrameworkItem[];
  onClose: () => void;
}

/** Resolves the same stripe color the matrix card uses for a given task,
 *  so the drawer's accent line never repaints when a card is clicked. */
export function resolveDrawerStripeColor(
  skillId: string,
  frameworkSkills: FrameworkItem[],
): string {
  return resolveSkillColor(skillId, frameworkSkills);
}

export function DrawerHeader({
  task,
  instance,
  skills,
  playbookOptions,
  frameworkSkills = [],
  onClose,
}: DrawerHeaderProps) {
  const skill = skills.find((s) => s.id === task.skillId);
  const playbook = task.playbookId
    ? playbookOptions.find((p) => p.id === task.playbookId)
    : null;
  const stage = instance.stages.find((s) => s.id === task.stageId);

  const title = playbook?.name ?? (task.playbookId ? "Playbook removed" : "Playbook");
  const description = playbook?.description?.trim() ?? "";
  const crumbs = [
    instance.label,
    stage?.label ?? task.stageId,
    skill?.label ?? task.skillId,
  ].filter(Boolean);

  return (
    <header
      className="pb-drawer-context"
      data-testid="pb-drawer-header"
    >
      <div className="pb-drawer-context__inner">
        <div className="pb-drawer-context__crumbs" data-testid="pb-drawer-crumbs">
          {crumbs.map((crumb, index) => (
            <span key={`${crumb}-${index}`}>
              {index > 0 ? (
                <span className="pb-drawer-context__crumb-sep" aria-hidden>
                  ·
                </span>
              ) : null}
              <span>{crumb}</span>
            </span>
          ))}
        </div>
        <button
          type="button"
          className="pb-drawer-context__close"
          aria-label="Close playbook drawer"
          title="Close"
          onClick={onClose}
          data-testid="pb-drawer-close"
        >
          <X size={14} aria-hidden />
        </button>
        <div className="pb-drawer-context__title-block">
          <h2 className="pb-drawer-context__title">{title}</h2>
          {description ? (
            <p className="pb-drawer-context__desc">{description}</p>
          ) : null}
        </div>
      </div>
    </header>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  markInputReceivedAction,
  pauseTaskAction,
  produceOutputAction,
  refinePlaybookAction,
  resumeTaskAction,
  retryBlockedTaskAction,
  startTaskAction,
} from "@/app/(dashboard)/workflows/actions";
import { captureError } from "@/lib/monitoring";
import { emitEvent } from "@/lib/events";
import { cn } from "@/lib/utils";
import type {
  FrameworkItem,
  WorkflowInstanceDetail,
  WorkflowSkill,
  WorkflowTask,
  WorkflowTemplate,
} from "@/lib/workflows/types";

import { ActionBar } from "./action-bar";
import { ChatFooter } from "./chat-footer";
import { CommentsSection } from "./comments-section";
import { DrawerHeader } from "./drawer-header";
import { HistorySection } from "./history-section";
import { InputsSection } from "./inputs-section";
import { OutputsSection } from "./outputs-section";
import { StateCard, type StateCardKind } from "./state-card";
import { useTaskState } from "./hooks/use-task-state";

export interface PlaybookDrawerProps {
  /** null → closed (component stays mounted for slide-out animation). */
  task: WorkflowTask | null;
  instance: WorkflowInstanceDetail;
  skills: WorkflowSkill[];
  template: WorkflowTemplate | null;
  playbookOptions?: FrameworkItem[];
  onClose: () => void;
  onTaskUpdate: (task: WorkflowTask) => void;
}

interface StateBanner {
  kind: StateCardKind;
  title: string;
  body: string;
}

function bannerFor(task: WorkflowTask): StateBanner | null {
  if (task.status === "waiting") {
    return {
      kind: "waiting",
      title: "Waiting on inputs",
      body:
        "This task can't start until the missing inputs are received. Mark them manually or wait for the upstream task to produce them.",
    };
  }
  if (task.status === "paused") {
    const reason = task.pausedReason?.trim();
    return {
      kind: "paused",
      title: reason === "checkpoint" ? "Paused — checkpoint" : "Paused",
      body: reason
        ? reason === "checkpoint"
          ? "Agent needs your sign-off before proceeding."
          : `Paused: ${reason}`
        : "This task is paused.",
    };
  }
  if (task.status === "failed") {
    return {
      kind: "failed",
      title: "Failed during execution",
      body: "Agent stopped before producing all outputs. Inspect the run, fix the cause, then retry.",
    };
  }
  return null;
}

export function PlaybookDrawer({
  task,
  instance,
  skills,
  playbookOptions = [],
  onClose,
  onTaskUpdate,
}: PlaybookDrawerProps) {
  const open = !!task;
  const closeRef = useRef<HTMLButtonElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const drawerData = useTaskState(task?.id);

  // Move focus inside drawer on open.
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  // Analytics on open.
  useEffect(() => {
    if (task) {
      emitEvent("dashboard.task_drawer_opened", { task_id: task.id });
    }
  }, [task?.id]);

  // Reset history collapse on task change.
  useEffect(() => {
    setHistoryOpen(false);
  }, [task?.id]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const taskEvents = useMemo(
    () => (task ? instance.events.filter((e) => e.taskId === task.id) : []),
    [instance.events, task],
  );

  if (!task) {
    return (
      <>
        <div className="pb-drawer-overlay" aria-hidden style={{ display: "none" }} />
        <div className="pb-drawer" data-testid="pb-drawer" aria-hidden />
      </>
    );
  }

  const banner = bannerFor(task);
  const isInputsDimmed = task.status === "paused";
  const isOutputsDimmed = task.status === "waiting" || task.status === "paused";

  // Wrappers around server actions: await + propagate update + refresh.
  function runAction<T extends { task: WorkflowTask }>(
    feature: string,
    fn: () => Promise<T>,
  ) {
    if (!task) return;
    startTransition(async () => {
      try {
        const result = await fn();
        onTaskUpdate(result.task);
        await drawerData.refresh();
      } catch (err) {
        captureError(err, { feature, extra: { task_id: task.id } });
      }
    });
  }

  function handleStart() {
    if (!task) return;
    const id = task.id;
    runAction("playbook-drawer.start", () => startTaskAction(id));
  }
  function handlePause() {
    if (!task) return;
    const id = task.id;
    runAction("playbook-drawer.pause", () => pauseTaskAction(id, "manual"));
  }
  function handleResume() {
    if (!task) return;
    const id = task.id;
    runAction("playbook-drawer.resume", () => resumeTaskAction(id));
  }
  function handleRetry() {
    if (!task) return;
    const id = task.id;
    runAction("playbook-drawer.retry", () => retryBlockedTaskAction(id));
  }
  function handleMarkReceived(inputId: string) {
    if (!task) return;
    startTransition(async () => {
      try {
        await markInputReceivedAction(task.id, inputId);
        await drawerData.refresh();
      } catch (err) {
        captureError(err, {
          feature: "playbook-drawer.mark_received",
          extra: { task_id: task.id, input_id: inputId },
        });
      }
    });
  }
  function handleProduce(outputId: string) {
    if (!task) return;
    startTransition(async () => {
      try {
        await produceOutputAction(task.id, outputId);
        await drawerData.refresh();
      } catch (err) {
        captureError(err, {
          feature: "playbook-drawer.produce_output",
          extra: { task_id: task.id, output_id: outputId },
        });
      }
    });
  }
  function handleRefine() {
    if (!task) return;
    startTransition(async () => {
      try {
        await refinePlaybookAction(task.id);
      } catch (err) {
        captureError(err, {
          feature: "playbook-drawer.refine",
          extra: { task_id: task.id },
        });
      }
    });
  }

  // Action mapping from banner buttons.
  const bannerActions = banner
    ? banner.kind === "waiting"
      ? [{ label: "Open upstream task", primary: true }]
      : banner.kind === "paused"
        ? [
            { label: "Resume", primary: true, onClick: handleResume },
            { label: "View pause reason", primary: false },
          ]
        : [
            { label: "Retry", primary: true, onClick: handleRetry },
            { label: "View error", primary: false },
          ]
    : [];

  // Compute hasUnmetInputs from drawer data (server is authoritative).
  const linkedDefIds = task.inputs
    .filter((i) => i.linkMode === "linked")
    .map((i) => i.id);
  const inputStates = drawerData.data?.inputs ?? [];
  const receivedById = new Map(inputStates.map((s) => [s.inputId, s.received]));
  const hasUnmetInputs = linkedDefIds.some((id) => receivedById.get(id) !== true);

  const busy = isPending || drawerData.loading;

  return (
    <>
      <div
        className="pb-drawer-overlay"
        aria-hidden
        data-testid="pb-drawer-overlay"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Playbook: ${task.playbookId ?? task.id}`}
        className={cn("pb-drawer", open && "pb-drawer--open")}
        data-testid="pb-drawer"
        data-status={task.status}
      >
        <DrawerHeader
          task={task}
          instance={instance}
          skills={skills}
          playbookOptions={playbookOptions}
          onClose={onClose}
        />
        <ActionBar
          status={task.status}
          hasUnmetInputs={hasUnmetInputs}
          busy={busy}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onRetry={handleRetry}
          onOpenPlaybook={undefined}
          onToggleHistory={() => setHistoryOpen((v) => !v)}
        />
        <div className="pb-drawer-body" data-testid="pb-drawer-body">
          {banner ? (
            <StateCard
              kind={banner.kind}
              title={banner.title}
              body={banner.body}
              actions={bannerActions}
            />
          ) : null}

          <InputsSection
            inputDefs={task.inputs}
            inputStates={inputStates}
            dimmed={isInputsDimmed}
            busy={busy}
            onMarkReceived={handleMarkReceived}
          />

          <OutputsSection
            status={task.status}
            outputDefs={drawerData.data?.playbookOutputs ?? []}
            outputStates={drawerData.data?.outputs ?? []}
            dimmed={isOutputsDimmed}
            busy={busy}
            onProduce={handleProduce}
          />

          <CommentsSection events={taskEvents} />

          <HistorySection
            events={taskEvents}
            open={historyOpen}
            onToggle={() => setHistoryOpen((v) => !v)}
          />
        </div>
        <ChatFooter
          status={task.status}
          events={taskEvents}
          busy={busy}
          onStart={handleStart}
          onRefine={handleRefine}
        />
      </aside>
    </>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  markInputReceivedAction,
  produceOutputAction,
  refinePlaybookAction,
  resumeTaskAction,
  retryBlockedTaskAction,
  setTaskStatusAction,
  startTaskAction,
  updateTaskDetailsAction,
} from "@/app/(dashboard)/workflows/actions";
import { captureError } from "@/lib/monitoring";
import { emitEvent } from "@/lib/events";
import { cn } from "@/lib/utils";
import type {
  FrameworkItem,
  TemplateOutputGroup,
  WorkflowInstanceDetail,
  WorkflowSkill,
  WorkflowTask,
  WorkflowTaskStatus,
  WorkflowTemplate,
} from "@/lib/workflows/types";

import { ActionBar } from "./action-bar";
import { ChatFooter } from "./chat-footer";
import { CommentsSection } from "./comments-section";
import {
  DrawerHeader,
  STATUS_BAR_VARIANT,
  resolveDrawerStripeColor,
} from "./drawer-header";
import { HistorySection } from "./history-section";
import { InputsSection } from "./inputs-section";
import { OutputsSection } from "./outputs-section";
import { StatusSection } from "./status-section";
import { useTaskState } from "./hooks/use-task-state";

export interface PlaybookDrawerProps {
  /** null → closed (component stays mounted for slide-out animation). */
  task: WorkflowTask | null;
  instance: WorkflowInstanceDetail;
  skills: WorkflowSkill[];
  template: WorkflowTemplate | null;
  playbookOptions?: FrameworkItem[];
  /** Framework skill catalog (with chosen colors). Used to paint the header
   *  stripe with the same color as the source card. Falls back to a stable
   *  id-hash color when the framework skill has been removed. */
  frameworkSkills?: FrameworkItem[];
  /** Cross-playbook output catalog for this template. Used to render linked
   *  inputs as "{playbookName} / {outputName}" instead of raw refs. */
  outputGroups?: TemplateOutputGroup[];
  onClose: () => void;
  onTaskUpdate: (task: WorkflowTask) => void;
}

export function PlaybookDrawer({
  task,
  instance,
  skills,
  playbookOptions = [],
  frameworkSkills = [],
  outputGroups = [],
  onClose,
  onTaskUpdate,
}: PlaybookDrawerProps) {
  const open = !!task;
  const closeRef = useRef<HTMLButtonElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  // `renderTask` mirrors `task` but lingers after `task` flips to null so
  // the slide-out transition has time to play before we unmount the
  // drawer's contents. The matching CSS transition is 260ms; we wait the
  // same and then clear.
  const [renderTask, setRenderTask] = useState<WorkflowTask | null>(task);
  // Two-step open: render the drawer offscreen first, then flip the
  // `--open` class one frame later so the browser actually animates the
  // transform instead of painting the open state on first commit.
  const [openClass, setOpenClass] = useState(false);
  const drawerData = useTaskState(task?.id);

  useEffect(() => {
    if (task) {
      // Opening (or switching tasks): render this task immediately, then
      // flip the open class next frame to trigger the slide-in.
      setRenderTask(task);
      const raf = requestAnimationFrame(() => setOpenClass(true));
      return () => cancelAnimationFrame(raf);
    }
    // Closing: drop the open class now so the slide-out runs against the
    // still-mounted contents, then unmount once the 260ms transition has
    // had time to play.
    setOpenClass(false);
    const timer = window.setTimeout(() => setRenderTask(null), 280);
    return () => window.clearTimeout(timer);
  }, [task]);

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

  // Use the lingering renderTask for body content so the drawer keeps
  // rendering its last task while sliding out.
  const activeTask = task ?? renderTask;

  const taskEvents = useMemo(
    () =>
      activeTask
        ? instance.events.filter((e) => e.taskId === activeTask.id)
        : [],
    [instance.events, activeTask],
  );

  if (!activeTask) {
    return (
      <>
        <div className="pb-drawer-overlay" aria-hidden style={{ display: "none" }} />
        <div className="pb-drawer" data-testid="pb-drawer" aria-hidden />
      </>
    );
  }

  const isInputsDimmed = activeTask.status === "paused";
  const isOutputsDimmed =
    activeTask.status === "waiting" || activeTask.status === "paused";

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
  function handleStatusChange(next: WorkflowTaskStatus) {
    if (!task) return;
    const id = task.id;
    runAction("playbook-drawer.status_change", () => setTaskStatusAction(id, next));
  }
  function handleStop() {
    if (!task) return;
    const id = task.id;
    runAction("playbook-drawer.stop", () => setTaskStatusAction(id, "paused"));
  }
  function handleCompleteTask() {
    if (!task) return;
    const id = task.id;
    runAction("playbook-drawer.complete", () =>
      setTaskStatusAction(id, "complete"),
    );
  }
  function handleOwnersChange(next: string[]) {
    if (!task) return;
    const id = task.id;
    runAction("playbook-drawer.owners_change", () =>
      updateTaskDetailsAction({
        taskId: id,
        playbookId: task.playbookId ?? null,
        notes: task.notes ?? "",
        owners: next,
        inputs: task.inputs,
      }),
    );
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

  const inputStates = drawerData.data?.inputs ?? [];
  const linkedDefIds = activeTask.inputs
    .filter((i) => i.linkMode === "linked")
    .map((i) => i.id);
  const receivedById = new Map(inputStates.map((s) => [s.inputId, s.received]));
  const hasUnmetInputs = linkedDefIds.some((id) => receivedById.get(id) !== true);

  const outputDefs = drawerData.data?.playbookOutputs ?? [];
  const outputStates = drawerData.data?.outputs ?? [];
  const producedOutputIds = new Set(
    outputStates.filter((o) => o.status === "produced").map((o) => o.outputId),
  );
  const pendingOutputs = outputDefs.filter(
    (def) => !producedOutputIds.has(def.id),
  );

  const busy = isPending || drawerData.loading;

  return (
    <>
      <div
        className={cn(
          "pb-drawer-overlay",
          openClass && "pb-drawer-overlay--open",
        )}
        aria-hidden
        data-testid="pb-drawer-overlay"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Playbook: ${activeTask.playbookId ?? activeTask.id}`}
        className={cn("pb-drawer", openClass && "pb-drawer--open")}
        data-testid="pb-drawer"
        data-status={activeTask.status}
      >
        <div
          className={cn(
            "pb-drawer-head",
            STATUS_BAR_VARIANT[activeTask.status] &&
              `pb-drawer-head--bar-${STATUS_BAR_VARIANT[activeTask.status]}`,
          )}
          style={
            {
              "--role-color": resolveDrawerStripeColor(
                activeTask.skillId,
                frameworkSkills,
              ),
            } as React.CSSProperties
          }
          data-testid="pb-drawer-head"
          data-bar-variant={STATUS_BAR_VARIANT[activeTask.status] ?? "none"}
        >
          <DrawerHeader
            task={activeTask}
            instance={instance}
            skills={skills}
            playbookOptions={playbookOptions}
            frameworkSkills={frameworkSkills}
            onClose={onClose}
          />
          <ActionBar
            task={activeTask}
            busy={busy}
            onOwnersChange={handleOwnersChange}
          />
          <StatusSection
            taskId={activeTask.id}
            status={activeTask.status}
            outputs={
              instance.taskIO.find((io) => io.taskId === activeTask.id)
                ?.outputs ?? []
            }
            busy={busy}
            onStatusChange={handleStatusChange}
          />
        </div>
        <div className="pb-drawer-body" data-testid="pb-drawer-body">
          <InputsSection
            inputDefs={activeTask.inputs}
            inputStates={inputStates}
            outputGroups={outputGroups}
            playbookOptions={playbookOptions}
            dimmed={isInputsDimmed}
            busy={busy}
            onMarkReceived={handleMarkReceived}
          />

          <OutputsSection
            status={activeTask.status}
            outputDefs={outputDefs}
            outputStates={outputStates}
            dimmed={isOutputsDimmed}
            busy={busy}
            loading={drawerData.data === null}
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
          task={activeTask}
          events={taskEvents}
          busy={busy}
          hasUnmetInputs={hasUnmetInputs}
          pendingOutputs={pendingOutputs}
          hasOutputs={outputDefs.length > 0}
          onStart={handleStart}
          onResume={handleResume}
          onRetry={handleRetry}
          onRefine={handleRefine}
          onStop={handleStop}
          onProduceOutput={handleProduce}
          onCompleteTask={handleCompleteTask}
        />
      </aside>
    </>
  );
}

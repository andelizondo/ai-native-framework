import type { WorkflowEvent } from "./types";

export interface HumanizedEvent {
  /** Display title for the event row. */
  title: string;
  /** Display name for the actor (person, agent, or system). */
  actor: string;
  /** When true, the actor is an AI agent (drives avatar emoji vs initials). */
  actorIsAgent: boolean;
}

const TITLES: Record<string, string> = {
  "workflow.task_started": "Task started",
  "workflow.task_paused": "Task paused",
  "workflow.task_resumed": "Task resumed",
  "workflow.task_completed": "Task completed",
  "workflow.task_failed": "Task failed",
  "workflow.task_status_set": "Status changed",
  "workflow.task_updated": "Task updated",
  "workflow.task_commented": "Comment added",
  "workflow.task_input_received": "Input received",
  "workflow.task_output_produced": "Output produced",
  "workflow.checkpoint_approved": "Checkpoint approved",
  "workflow.checkpoint_rejected": "Checkpoint rejected",
  "workflow.run_cancelled": "Run cancelled",
  "workflow.run_retried": "Run retried",
};

function titleCase(segment: string): string {
  return segment
    .split(/[_-]/)
    .filter(Boolean)
    .map((word, i) =>
      i === 0
        ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        : word.toLowerCase(),
    )
    .join(" ");
}

function fallbackTitle(name: string): string {
  const tail = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : name;
  return titleCase(tail) || "Event";
}

const AGENT_HINTS = ["agent", "bot", "system"];

function isAgentActor(actor: string): boolean {
  const lower = actor.toLowerCase();
  return AGENT_HINTS.some((hint) => lower.includes(hint));
}

export function humanizeEvent(event: WorkflowEvent): HumanizedEvent {
  const title = TITLES[event.name] ?? fallbackTitle(event.name);
  const payload = event.payload ?? {};
  const rawActor =
    (payload.author as string | undefined) ??
    (payload.actor as string | undefined) ??
    (payload.user as string | undefined) ??
    "System";
  const actor = rawActor.trim().length > 0 ? rawActor.trim() : "System";
  return { title, actor, actorIsAgent: isAgentActor(actor) };
}

export function actorInitials(actor: string): string {
  const parts = actor
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "··";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

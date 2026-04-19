"use server";

import { revalidatePath } from "next/cache";

import { getServerWorkflowRepository } from "@/lib/workflows/repository.server";
import type { WorkflowInstance } from "@/lib/workflows/types";

/**
 * Server action invoked by the create-instance modal.
 *
 * Calls into the cookie-aware Supabase repository so RLS sees the signed-in
 * user (DEC-002), then `revalidatePath('/', 'layout')` so the next render
 * of the dashboard layout (and therefore the sidebar workflow tree fed by
 * `getServerWorkflowRepository().listInstances()`) picks up the new row.
 *
 * Returns the persisted instance so the modal can navigate to
 * `/workflows/{id}` without a second round-trip.
 *
 * Inputs are trimmed and length-clamped here so untrusted client input
 * cannot smuggle blank labels or pathological strings into the database.
 */

const MAX_LABEL_LENGTH = 120;

export interface CreateInstanceResult {
  instance: WorkflowInstance;
}

export async function createInstanceAction(
  templateId: string,
  rawLabel: string,
): Promise<CreateInstanceResult> {
  if (typeof templateId !== "string" || !templateId.trim()) {
    throw new Error("createInstanceAction: templateId is required");
  }
  if (typeof rawLabel !== "string") {
    throw new Error("createInstanceAction: label must be a string");
  }

  const label = rawLabel.trim().slice(0, MAX_LABEL_LENGTH);
  if (!label) {
    throw new Error("createInstanceAction: label cannot be empty");
  }

  const repo = await getServerWorkflowRepository();
  const detail = await repo.createInstance(templateId.trim(), label);

  revalidatePath("/", "layout");

  // Strip the heavy `tasks`/`events` arrays before returning to the client —
  // the modal only needs the persisted id + label to navigate.
  const { tasks: _tasks, events: _events, ...instance } = detail;
  return { instance };
}

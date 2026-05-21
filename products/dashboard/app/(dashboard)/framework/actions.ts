"use server";

import { revalidatePath } from "next/cache";

import { getServerWorkflowRepository } from "@/lib/workflows/repository.server";
import type {
  FrameworkItem,
  FrameworkItemType,
  PlaybookInput,
  PlaybookOutput,
  PlaybookOutputKind,
  TemplateOutputGroup,
} from "@/lib/workflows/types";

const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 240;
const MAX_OUTPUT_NAME_LENGTH = 80;
const MAX_OUTPUT_DESCRIPTION_LENGTH = 240;
const PLAYBOOK_OUTPUT_KINDS: readonly PlaybookOutputKind[] = [
  "file",
  "media",
  "link",
  "manual",
  "api",
] as const;

function normalizeRequiredField(
  value: string,
  label: string,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }

  const normalized = value.trim().slice(0, maxLength);
  if (!normalized) {
    throw new Error(`${label} is required`);
  }

  return normalized;
}

function normalizeOptionalText(
  value: unknown,
  maxLength: number,
): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeType(type: FrameworkItemType): FrameworkItemType {
  if (type !== "skill" && type !== "playbook") {
    throw new Error(`Unsupported framework item type "${type}"`);
  }
  return type;
}

function revalidateFrameworkPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/framework/skills");
  revalidatePath("/framework/playbooks");
}

export async function upsertFrameworkItemAction(
  item: FrameworkItem,
): Promise<{ item: FrameworkItem }> {
  const repo = await getServerWorkflowRepository();
  const type = normalizeType(item.type);

  const saved = await repo.upsertFrameworkItem({
    id: normalizeRequiredField(item.id, "Framework item id", 160),
    type,
    name: normalizeRequiredField(item.name, "Framework item name", MAX_NAME_LENGTH),
    description: normalizeOptionalText(item.description, MAX_DESCRIPTION_LENGTH),
    icon: item.icon?.trim() ? item.icon.trim().slice(0, 16) : null,
    color: typeof item.color === "string" && item.color.trim() ? item.color.trim().slice(0, 32) : null,
    content: typeof item.content === "string" ? item.content : "",
    allowedSkillIds:
      type === "playbook" && Array.isArray(item.allowedSkillIds)
        ? item.allowedSkillIds
            .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
            .map((id) => id.trim().slice(0, 80))
        : undefined,
    allowedPlaybookIds:
      type === "skill" && Array.isArray(item.allowedPlaybookIds)
        ? item.allowedPlaybookIds
            .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
            .map((id) => id.trim().slice(0, 80))
        : undefined,
  });

  revalidateFrameworkPaths();
  return { item: saved };
}

export async function deleteFrameworkItemAction(itemId: string): Promise<void> {
  const repo = await getServerWorkflowRepository();
  const normalizedId = normalizeRequiredField(itemId, "Framework item id", 160);

  await repo.deleteFrameworkItem(normalizedId);
  revalidateFrameworkPaths();
}

// ---------------------------------------------------------------------------
// Playbook outputs (AEL-63 / PR 5). Definition-level CRUD on
// `playbook_outputs`. Drawer + matrix already read these rows; mutating
// actions revalidate the dashboard layout so open views pick up changes.
// ---------------------------------------------------------------------------

function normalizeOutputKind(kind: unknown): PlaybookOutputKind {
  if (
    typeof kind === "string" &&
    (PLAYBOOK_OUTPUT_KINDS as readonly string[]).includes(kind)
  ) {
    return kind as PlaybookOutputKind;
  }
  throw new Error(
    `Output kind must be one of: ${PLAYBOOK_OUTPUT_KINDS.join(", ")}`,
  );
}

function normalizeOutputDescription(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error("Output description must be a string");
  }
  const trimmed = value.trim().slice(0, MAX_OUTPUT_DESCRIPTION_LENGTH);
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeApiCheck(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("api_check must be a JSON object");
  }
  return value as Record<string, unknown>;
}

export async function listPlaybookOutputsAction(
  playbookId: string,
): Promise<PlaybookOutput[]> {
  const repo = await getServerWorkflowRepository();
  const id = normalizeRequiredField(playbookId, "Playbook id", 160);
  return repo.listPlaybookOutputs(id);
}

export async function createPlaybookOutputAction(input: {
  playbookId: string;
  name: string;
  description?: string | null;
  kind: PlaybookOutputKind;
  apiCheck?: Record<string, unknown> | null;
}): Promise<PlaybookOutput> {
  const repo = await getServerWorkflowRepository();
  const created = await repo.createPlaybookOutput({
    playbookId: normalizeRequiredField(input.playbookId, "Playbook id", 160),
    name: normalizeRequiredField(input.name, "Output name", MAX_OUTPUT_NAME_LENGTH),
    description: normalizeOutputDescription(input.description),
    kind: normalizeOutputKind(input.kind),
    apiCheck: normalizeApiCheck(input.apiCheck),
  });
  revalidateFrameworkPaths();
  return created;
}

export async function updatePlaybookOutputAction(
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    kind?: PlaybookOutputKind;
    apiCheck?: Record<string, unknown> | null;
  },
): Promise<PlaybookOutput> {
  const repo = await getServerWorkflowRepository();
  const normalizedId = normalizeRequiredField(id, "Output id", 160);

  const dbPatch: Parameters<typeof repo.updatePlaybookOutput>[1] = {};
  if (patch.name !== undefined) {
    dbPatch.name = normalizeRequiredField(
      patch.name,
      "Output name",
      MAX_OUTPUT_NAME_LENGTH,
    );
  }
  if (patch.description !== undefined) {
    dbPatch.description = normalizeOutputDescription(patch.description);
  }
  if (patch.kind !== undefined) {
    dbPatch.kind = normalizeOutputKind(patch.kind);
  }
  if (patch.apiCheck !== undefined) {
    dbPatch.apiCheck = normalizeApiCheck(patch.apiCheck);
  }
  if (Object.keys(dbPatch).length === 0) {
    throw new Error("updatePlaybookOutputAction: empty patch");
  }

  const updated = await repo.updatePlaybookOutput(normalizedId, dbPatch);
  revalidateFrameworkPaths();
  return updated;
}

export async function deletePlaybookOutputAction(id: string): Promise<void> {
  const repo = await getServerWorkflowRepository();
  const normalizedId = normalizeRequiredField(id, "Output id", 160);
  await repo.deletePlaybookOutput(normalizedId);
  revalidateFrameworkPaths();
}

export async function reorderPlaybookOutputsAction(
  playbookId: string,
  orderedIds: string[],
): Promise<void> {
  const repo = await getServerWorkflowRepository();
  const id = normalizeRequiredField(playbookId, "Playbook id", 160);
  if (!Array.isArray(orderedIds)) {
    throw new Error("orderedIds must be an array");
  }
  const ids = orderedIds
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());
  await repo.reorderPlaybookOutputs(id, ids);
  revalidateFrameworkPaths();
}

export async function countTaskOutputsForPlaybookOutputAction(
  outputId: string,
): Promise<number> {
  const repo = await getServerWorkflowRepository();
  const id = normalizeRequiredField(outputId, "Output id", 160);
  return repo.countTaskOutputsForPlaybookOutput(id);
}

// ---------------------------------------------------------------------------
// Playbook inputs — each input is a reference to an upstream output of
// another playbook. The metadata dock on the playbook edit page renders
// the Inputs section using `listOutputGroupsForOtherPlaybooks` as the
// catalog for the "+ Add input" picker. The Add Playbook drawer snapshots
// these declarations into each new task as `WorkflowInput { upstreamOutputId }`.
// ---------------------------------------------------------------------------

export async function listPlaybookInputsAction(
  playbookId: string,
): Promise<PlaybookInput[]> {
  const repo = await getServerWorkflowRepository();
  const id = normalizeRequiredField(playbookId, "Playbook id", 160);
  return repo.listPlaybookInputs(id);
}

export async function createPlaybookInputAction(input: {
  playbookId: string;
  upstreamOutputId: string;
}): Promise<PlaybookInput> {
  const repo = await getServerWorkflowRepository();
  const created = await repo.createPlaybookInput({
    playbookId: normalizeRequiredField(input.playbookId, "Playbook id", 160),
    upstreamOutputId: normalizeRequiredField(
      input.upstreamOutputId,
      "Upstream output id",
      160,
    ),
  });
  revalidateFrameworkPaths();
  return created;
}

export async function deletePlaybookInputAction(id: string): Promise<void> {
  const repo = await getServerWorkflowRepository();
  const normalizedId = normalizeRequiredField(id, "Input id", 160);
  await repo.deletePlaybookInput(normalizedId);
  revalidateFrameworkPaths();
}

export async function reorderPlaybookInputsAction(
  playbookId: string,
  orderedIds: string[],
): Promise<void> {
  const repo = await getServerWorkflowRepository();
  const id = normalizeRequiredField(playbookId, "Playbook id", 160);
  if (!Array.isArray(orderedIds)) {
    throw new Error("orderedIds must be an array");
  }
  const ids = orderedIds
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());
  await repo.reorderPlaybookInputs(id, ids);
  revalidateFrameworkPaths();
}

export async function listOutputGroupsForOtherPlaybooksAction(
  currentPlaybookId: string,
): Promise<TemplateOutputGroup[]> {
  const repo = await getServerWorkflowRepository();
  const id = normalizeRequiredField(currentPlaybookId, "Playbook id", 160);
  return repo.listOutputGroupsForOtherPlaybooks(id);
}

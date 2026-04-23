"use server";

import { revalidatePath } from "next/cache";

import { getServerWorkflowRepository } from "@/lib/workflows/repository.server";
import type { FrameworkItem, FrameworkItemType } from "@/lib/workflows/types";

const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 240;

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
    description: normalizeRequiredField(
      item.description,
      "Framework item description",
      MAX_DESCRIPTION_LENGTH,
    ),
    icon: item.icon?.trim() ? item.icon.trim().slice(0, 16) : null,
    content: typeof item.content === "string" ? item.content : "",
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

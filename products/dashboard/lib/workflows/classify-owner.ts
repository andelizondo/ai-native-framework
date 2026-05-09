export type OwnerKind = "person" | "agent";

/**
 * Classify an owner label as a person or an AI agent. Convention: labels
 * prefixed with `agent:` (case-insensitive) are agents; everything else is
 * a person. Empty / non-string input is treated as a person to keep the
 * avatar stack rendering defensively.
 */
export function classifyOwner(label: string): OwnerKind {
  if (typeof label !== "string") return "person";
  return /^agent:/i.test(label.trim()) ? "agent" : "person";
}

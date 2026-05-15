import type { PlaybookOutput, PlaybookOutputKind } from "@/lib/workflows/types";

export interface OutputKindAvatar {
  emoji: string;
  color: string;
}

/** Visual encoding per output kind: emoji + ring color the avatar uses
 *  in place of a text chip. One source of truth shared by the live drawer
 *  outputs section, the AddPlaybookDrawer outputs editor, and any matrix
 *  pip tooltips that need to match the same palette. */
export const OUTPUT_KIND_AVATAR: Record<PlaybookOutputKind, OutputKindAvatar> = {
  file: { emoji: "📎", color: "#3b82f6" },
  media: { emoji: "🎬", color: "#a855f7" },
  link: { emoji: "🔗", color: "#06b6d4" },
  api: { emoji: "🔌", color: "#10b981" },
  manual: { emoji: "✏️", color: "#f59e0b" },
};

export function outputKindAvatar(kind: PlaybookOutputKind | null): OutputKindAvatar {
  return OUTPUT_KIND_AVATAR[kind ?? "manual"];
}

/** Convenience helper for output rows that need the kind label string. */
export function outputKindLabel(output: Pick<PlaybookOutput, "kind">): string {
  return `${output.kind ?? "manual"} output`;
}

/**
 * Hardcoded owner catalog: the people on the team plus the AI agents we
 * currently surface in the framework.
 *
 * Source for people: existing seed owners in
 * `supabase/migrations/20260503120100_workflow_seed.sql`. AI list mirrors
 * the top frontier models from the major providers (Anthropic, OpenAI,
 * Google, xAI) — refresh as new flagship models ship.
 *
 * Each option carries enough metadata to render the same avatar + title +
 * subtitle treatment used by the allowed-skills/playbooks picker, so the
 * two pickers feel like one design family.
 */

export type OwnerGroup = "people" | "agents";

export interface OwnerOption {
  id: string;
  /** Display label that gets persisted to `WorkflowSkill.owners`. */
  label: string;
  group: OwnerGroup;
  /** Short caption rendered under the title in the picker (role for
   *  people, provider/family for agents). */
  subtitle: string;
  /** Avatar treatment: people use 1–2 letter initials, agents use an emoji
   *  glyph. Both render inside the colored ring used elsewhere. */
  initials?: string;
  emoji?: string;
  /** Hex color for the ring. Used by the avatar in the picker. */
  color: string;
}

export const PEOPLE_OWNERS: OwnerOption[] = [
  {
    id: "person-andres",
    label: "Andres",
    group: "people",
    subtitle: "Founder",
    initials: "AE",
    color: "#6366f1",
  },
  {
    id: "person-cristina",
    label: "Cristina",
    group: "people",
    subtitle: "Growth",
    initials: "CR",
    color: "#ec4899",
  },
  {
    id: "person-dave",
    label: "Dave",
    group: "people",
    subtitle: "Sales Ops",
    initials: "DA",
    color: "#10b981",
  },
  {
    id: "person-dechaun",
    label: "Dechaun",
    group: "people",
    subtitle: "Product",
    initials: "DE",
    color: "#f59e0b",
  },
  {
    id: "person-hans",
    label: "Hans",
    group: "people",
    subtitle: "Sales Ops",
    initials: "HA",
    color: "#06b6d4",
  },
  {
    id: "person-joanna",
    label: "Joanna",
    group: "people",
    subtitle: "Finance Ops",
    initials: "JO",
    color: "#8b5cf6",
  },
  {
    id: "person-noah",
    label: "Noah",
    group: "people",
    subtitle: "Builder",
    initials: "NO",
    color: "#f97316",
  },
  {
    id: "person-patrick",
    label: "Patrick",
    group: "people",
    subtitle: "Project Mgmt",
    initials: "PA",
    color: "#14b8a6",
  },
  {
    id: "person-robert",
    label: "Robert",
    group: "people",
    subtitle: "DevOps",
    initials: "RO",
    color: "#64748b",
  },
];

export const AGENT_OWNERS: OwnerOption[] = [
  {
    id: "agent-claude-opus-4-7",
    label: "Claude Opus 4.7",
    group: "agents",
    subtitle: "Anthropic · frontier reasoning",
    emoji: "🧠",
    color: "#d97706",
  },
  {
    id: "agent-claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    group: "agents",
    subtitle: "Anthropic · everyday workhorse",
    emoji: "🎼",
    color: "#a855f7",
  },
  {
    id: "agent-gpt-5",
    label: "GPT-5",
    group: "agents",
    subtitle: "OpenAI · general purpose",
    emoji: "✨",
    color: "#10b981",
  },
  {
    id: "agent-gpt-5-codex",
    label: "GPT-5 Codex",
    group: "agents",
    subtitle: "OpenAI · code specialist",
    emoji: "💻",
    color: "#0ea5e9",
  },
  {
    id: "agent-gemini-2-5-pro",
    label: "Gemini 2.5 Pro",
    group: "agents",
    subtitle: "Google · long context",
    emoji: "🔷",
    color: "#3b82f6",
  },
  {
    id: "agent-grok-4",
    label: "Grok 4",
    group: "agents",
    subtitle: "xAI · realtime web",
    emoji: "🛰️",
    color: "#737373",
  },
];

export const ALL_OWNERS: OwnerOption[] = [...PEOPLE_OWNERS, ...AGENT_OWNERS];

export function findOwnerByLabel(label: string | null | undefined): OwnerOption | null {
  if (!label) return null;
  const trimmed = label.trim();
  if (!trimmed) return null;
  return ALL_OWNERS.find((option) => option.label === trimmed) ?? null;
}

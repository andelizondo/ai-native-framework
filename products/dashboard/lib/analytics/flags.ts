// Server-side flag evaluation for Server Components and Route Handlers.
// Add new flag keys to the FeatureFlag type before using them anywhere.
//
// Client-side flags: use posthog.isFeatureEnabled() via usePostHog() from posthog-js/react
// only inside a dedicated useFlag hook — never inline in feature components.

import { getPostHogClient } from "./posthog-server";

// Extend this union as flags are created in the PostHog dashboard.
// Document flag intent and rollout plan in the decision log before creating the flag.
export type FeatureFlag = "example-flag";

export async function getFlag(
  flag: FeatureFlag,
  distinctId: string,
): Promise<boolean> {
  const client = getPostHogClient();
  const value = await client.isFeatureEnabled(flag, distinctId);
  await client.shutdown();
  return value ?? false;
}

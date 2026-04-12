import { PostHog } from "posthog-node";

export function getPostHogClient(): PostHog {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) {
    throw new Error(
      "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is not set — server-side PostHog capture is unavailable",
    );
  }
  return new PostHog(token, {
    host: "https://eu.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
}

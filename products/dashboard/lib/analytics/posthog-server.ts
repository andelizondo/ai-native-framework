import { PostHog } from "posthog-node";

export function getPostHogClient(): PostHog {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) {
    throw new Error(
      "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is not set — server-side PostHog capture is unavailable",
    );
  }
  return new PostHog(token, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
}

/** Run `fn` with a fresh PostHog client and shut it down in a finally block. */
export async function withPostHogClient<T>(
  fn: (client: PostHog) => Promise<T>,
): Promise<T> {
  const client = getPostHogClient();
  try {
    return await fn(client);
  } finally {
    await client.shutdown();
  }
}

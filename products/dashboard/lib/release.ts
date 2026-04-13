function normalizeOptionalEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function getAppRelease(): string | undefined {
  return (
    normalizeOptionalEnv(process.env.NEXT_PUBLIC_APP_RELEASE) ??
    normalizeOptionalEnv(process.env.APP_RELEASE) ??
    normalizeOptionalEnv(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA) ??
    normalizeOptionalEnv(process.env.VERCEL_GIT_COMMIT_SHA)
  );
}

export function getReleaseChannel(): string {
  return (
    normalizeOptionalEnv(process.env.NEXT_PUBLIC_RELEASE_CHANNEL) ??
    normalizeOptionalEnv(process.env.APP_RELEASE_CHANNEL) ??
    normalizeOptionalEnv(process.env.VERCEL_ENV) ??
    normalizeOptionalEnv(process.env.NODE_ENV) ??
    "development"
  );
}

export function getReleaseProperties(): Record<string, string> {
  const release = getAppRelease();

  return {
    ...(release ? { app_release: release } : {}),
    release_channel: getReleaseChannel(),
  };
}

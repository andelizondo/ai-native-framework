"use client";

/**
 * lib/monitoring/boundary.tsx
 *
 * React error boundary for client components that need explicit error containment.
 * Wraps Sentry.ErrorBoundary with a required feature tag so every bounded region
 * is identifiable in Sentry without the caller knowing anything about Sentry.
 *
 * Usage:
 *   <MonitoringBoundary feature="spec-editor" fallback={<ErrorState />}>
 *     <SpecEditor />
 *   </MonitoringBoundary>
 */

import * as Sentry from "@sentry/nextjs";

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  feature: string; // required — forces the caller to name the feature being bounded
};

export function MonitoringBoundary({ children, fallback, feature }: Props) {
  return (
    <Sentry.ErrorBoundary
      fallback={fallback !== undefined ? (fallback as React.ReactElement) : undefined}
      beforeCapture={(scope) => {
        scope.setTag("feature", feature);
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}

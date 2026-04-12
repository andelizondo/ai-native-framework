"use client";

/**
 * ShellEvents — client component, renders nothing.
 *
 * Fires dashboard.shell_viewed on every page mount per the spec event catalog.
 * Include once per page.tsx, passing the current route string.
 */

import { useEffect } from "react";
import { emitEvent } from "@/lib/events";

export function ShellEvents({ route }: { route: string }) {
  useEffect(() => {
    emitEvent("dashboard.shell_viewed", { route });
  }, [route]);

  return null;
}

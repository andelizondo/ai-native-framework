"use client";

import { useCallback, useEffect, useState } from "react";

import { getDrawerDataAction } from "@/app/(dashboard)/workflows/actions";
import { captureError } from "@/lib/monitoring";
import type { DrawerData } from "@/lib/workflows/types";

export interface UseDrawerDataResult {
  data: DrawerData | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Wraps `getDrawerDataAction` so the playbook drawer can render with one
 * round-trip. Re-fetches whenever `taskId` changes; callers invoke
 * `refresh()` after a mutating action to re-sync the drawer's view.
 *
 * Realtime subscriptions on `workflow_tasks` / `task_inputs` /
 * `task_outputs` are a follow-up — see use-task-state.ts.
 */
export function useDrawerData(taskId: string | null | undefined): UseDrawerDataResult {
  const [data, setData] = useState<DrawerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!taskId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getDrawerDataAction(taskId);
      setData(result);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      captureError(e, { feature: "playbook-drawer.fetch", extra: { task_id: taskId } });
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

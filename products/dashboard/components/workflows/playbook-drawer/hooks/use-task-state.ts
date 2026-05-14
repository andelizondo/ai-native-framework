"use client";

import { useDrawerData, type UseDrawerDataResult } from "./use-drawer-data";

/**
 * Façade over `useDrawerData` that the drawer's sections subscribe to.
 *
 * TODO(AEL-61 follow-up): swap this for a Supabase realtime subscription on
 * `workflow_tasks`, `task_inputs`, `task_outputs`, and `agent_runs` filtered
 * by taskId. The shape returned here is stable enough that call sites won't
 * change when realtime lands.
 */
export function useTaskState(taskId: string | null | undefined): UseDrawerDataResult {
  return useDrawerData(taskId);
}

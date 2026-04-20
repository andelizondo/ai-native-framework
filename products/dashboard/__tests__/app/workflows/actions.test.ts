// @vitest-environment node

/**
 * Unit tests for the checkpoint precondition gate enforced by
 * `resolveCheckpointAction`.
 *
 * The action is the only write path the Overview "My Tasks" card exposes
 * to clients. Without business-level validation, a crafted client
 * payload could flip any task that RLS lets the user touch — including
 * non-checkpoint tasks, or checkpoints that are not currently waiting
 * — into `complete` / `blocked` and emit a misleading domain event.
 *
 * The repository now exposes `transitionPendingCheckpoint(id, nextStatus)`
 * which collapses the precondition + write into a single atomic
 * conditional UPDATE (`WHERE checkpoint = TRUE AND status =
 * 'pending_approval'`). When no row matches, the method returns `null`
 * and the action throws — without calling `addEvent` or revalidating —
 * so the database state and event feed stay truthful.
 *
 * These tests assert the action:
 *   - rejects when no row matched the conditional update (covers the
 *     missing / not-a-checkpoint / not-pending_approval cases)
 *   - never calls `addEvent` / `revalidatePath` on the rejection path
 *   - calls `transitionPendingCheckpoint` + `addEvent` + revalidates on
 *     the happy path
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import type {
  WorkflowCheckpointTransitionStatus,
  WorkflowEvent,
  WorkflowRepository,
  WorkflowTask,
} from "@/lib/workflows/types";

const { mockGetRepo, mockRevalidatePath, mockCaptureError } = vi.hoisted(() => ({
  mockGetRepo: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockCaptureError: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("@/lib/monitoring", () => ({
  captureError: mockCaptureError,
}));

vi.mock("@/lib/workflows/repository.server", () => ({
  getServerWorkflowRepository: mockGetRepo,
}));

import {
  cancelRunningTaskAction,
  createTaskAction,
  deleteTaskAction,
  moveTaskAction,
  resolveCheckpointAction,
  retryBlockedTaskAction,
  startTaskAction,
} from "@/app/(dashboard)/workflows/actions";

function makeTask(overrides: Partial<WorkflowTask> = {}): WorkflowTask {
  return {
    id: "task-1",
    instanceId: "instance-1",
    roleId: "role-1",
    stageId: "stage-1",
    title: "Approve scope",
    description: "",
    status: "pending_approval",
    substatus: "",
    checkpoint: true,
    triggers: [],
    gates: [],
    agent: null,
    skill: null,
    playbook: null,
    createdAt: "2026-04-19T12:00:00Z",
    updatedAt: "2026-04-19T12:00:00Z",
    ...overrides,
  };
}

interface RepoMocks {
  transitionPendingCheckpoint: ReturnType<typeof vi.fn>;
  addEvent: ReturnType<typeof vi.fn>;
}

/**
 * `transitioned` is what the conditional UPDATE would return:
 *   - a `WorkflowTask` when the row matched and was flipped
 *   - `null` when no row matched the predicates (missing, not a
 *     checkpoint, not pending_approval, or RLS-hidden)
 */
function setupRepo(transitioned: WorkflowTask | null): RepoMocks {
  const event: WorkflowEvent = {
    id: "event-1",
    instanceId: "instance-1",
    taskId: "task-1",
    name: "workflow.checkpoint_approved",
    description: "Approved",
    payload: {},
    createdAt: "2026-04-19T12:00:00Z",
  };

  const mocks: RepoMocks = {
    transitionPendingCheckpoint: vi
      .fn()
      .mockImplementation(async (_id: string, nextStatus: WorkflowCheckpointTransitionStatus) =>
        transitioned ? makeTask({ ...transitioned, status: nextStatus }) : null,
      ),
    addEvent: vi.fn().mockResolvedValue(event),
  };

  const repo: Partial<WorkflowRepository> = {
    transitionPendingCheckpoint: mocks.transitionPendingCheckpoint,
    addEvent: mocks.addEvent,
  };

  mockGetRepo.mockResolvedValue(repo);
  return mocks;
}

describe("resolveCheckpointAction precondition gate", () => {
  beforeEach(() => {
    mockGetRepo.mockReset();
    mockRevalidatePath.mockReset();
    mockCaptureError.mockReset();
  });

  it("rejects an empty taskId before touching the repository", async () => {
    setupRepo(makeTask());

    await expect(
      resolveCheckpointAction("   ", "approved"),
    ).rejects.toThrow(/taskId is required/);

    expect(mockGetRepo).not.toHaveBeenCalled();
  });

  it("rejects an unknown resolution string before touching the repository", async () => {
    setupRepo(makeTask());

    await expect(
      resolveCheckpointAction(
        "task-1",
        "yolo" as unknown as "approved",
      ),
    ).rejects.toThrow(/unknown resolution/);

    expect(mockGetRepo).not.toHaveBeenCalled();
  });

  it("rejects when the conditional update matches no row and never writes", async () => {
    // `null` covers the union of: row missing, not a checkpoint, not in
    // pending_approval, or hidden by RLS. The action does not — and
    // cannot — distinguish these cases at the application layer, since
    // the atomic UPDATE only reports whether *something* matched.
    const repo = setupRepo(null);

    await expect(
      resolveCheckpointAction("task-1", "approved"),
    ).rejects.toThrow(
      /missing, not a checkpoint, or no longer pending_approval/,
    );

    expect(repo.transitionPendingCheckpoint).toHaveBeenCalledWith(
      "task-1",
      "complete",
    );
    expect(repo.addEvent).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("trims the taskId before issuing the conditional update", async () => {
    const repo = setupRepo(makeTask());

    await resolveCheckpointAction("  task-1  ", "approved");

    expect(repo.transitionPendingCheckpoint).toHaveBeenCalledWith(
      "task-1",
      "complete",
    );
  });

  it("calls transitionPendingCheckpoint + addEvent + revalidatePath on the happy path", async () => {
    const repo = setupRepo(makeTask());

    const result = await resolveCheckpointAction("task-1", "approved");

    expect(repo.transitionPendingCheckpoint).toHaveBeenCalledWith(
      "task-1",
      "complete",
    );
    expect(repo.addEvent).toHaveBeenCalledTimes(1);
    expect(repo.addEvent.mock.calls[0]?.[1].name).toBe(
      "workflow.checkpoint_approved",
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(result.task.status).toBe("complete");
  });

  it("maps `rejected` resolution to status=blocked + checkpoint_rejected event", async () => {
    const repo = setupRepo(makeTask());

    await resolveCheckpointAction("task-1", "rejected");

    expect(repo.transitionPendingCheckpoint).toHaveBeenCalledWith(
      "task-1",
      "blocked",
    );
    expect(repo.addEvent.mock.calls[0]?.[1].name).toBe(
      "workflow.checkpoint_rejected",
    );
  });

  it("captures audit-event errors but still revalidates and returns the updated task", async () => {
    const repo = setupRepo(makeTask());
    repo.addEvent.mockRejectedValueOnce(new Error("event write failed"));

    const result = await resolveCheckpointAction("task-1", "approved");

    expect(repo.transitionPendingCheckpoint).toHaveBeenCalledTimes(1);
    expect(mockCaptureError).toHaveBeenCalledTimes(1);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(result.task.status).toBe("complete");
  });
});

describe("workflow matrix edit actions", () => {
  beforeEach(() => {
    mockGetRepo.mockReset();
    mockRevalidatePath.mockReset();
    mockCaptureError.mockReset();
  });

  it("createTaskAction creates a task and records an event", async () => {
    const created = makeTask({ id: "task-created", status: "not_started" });
    const createTask = vi.fn().mockResolvedValue(created);
    const addEvent = vi.fn().mockResolvedValue({
      id: "event-2",
      instanceId: created.instanceId,
      taskId: created.id,
      name: "workflow.task_created",
      description: "",
      payload: {},
      createdAt: "2026-04-19T12:00:00Z",
    });

    mockGetRepo.mockResolvedValue({
      createTask,
      addEvent,
    } satisfies Partial<WorkflowRepository>);

    const result = await createTaskAction({
      instanceId: created.instanceId,
      roleId: created.roleId,
      stageId: created.stageId,
      title: created.title,
      description: created.description,
      skill: "pm",
      agent: "PM",
      playbook: "slice-spec",
    });

    expect(createTask).toHaveBeenCalled();
    expect(addEvent.mock.calls[0]?.[1].name).toBe("workflow.task_created");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(result.task.id).toBe("task-created");
  });

  it("moveTaskAction updates the task position and records an event", async () => {
    const current = makeTask({ id: "task-move", roleId: "sales", stageId: "pre-sales" });
    const moved = makeTask({ id: "task-move", roleId: "product", stageId: "stage-2" });
    const getTask = vi.fn().mockResolvedValue(current);
    const updateTask = vi.fn().mockResolvedValue(moved);
    const addEvent = vi.fn().mockResolvedValue({
      id: "event-3",
      instanceId: moved.instanceId,
      taskId: moved.id,
      name: "workflow.task_moved",
      description: "",
      payload: {},
      createdAt: "2026-04-19T12:00:00Z",
    });

    mockGetRepo.mockResolvedValue({
      getTask,
      updateTask,
      addEvent,
    } satisfies Partial<WorkflowRepository>);

    const result = await moveTaskAction("task-move", "product", "stage-2");

    expect(updateTask).toHaveBeenCalledWith("task-move", {
      roleId: "product",
      stageId: "stage-2",
    });
    expect(addEvent.mock.calls[0]?.[1].name).toBe("workflow.task_moved");
    expect(result.task.roleId).toBe("product");
  });

  it("deleteTaskAction deletes the task and records an instance event", async () => {
    const existing = makeTask({ id: "task-delete" });
    const getTask = vi.fn().mockResolvedValue(existing);
    const deleteTask = vi.fn().mockResolvedValue(undefined);
    const addInstanceEvent = vi.fn().mockResolvedValue({
      id: "event-4",
      instanceId: existing.instanceId,
      taskId: null,
      name: "workflow.task_deleted",
      description: "",
      payload: {},
      createdAt: "2026-04-19T12:00:00Z",
    });

    mockGetRepo.mockResolvedValue({
      getTask,
      deleteTask,
      addInstanceEvent,
    } satisfies Partial<WorkflowRepository>);

    await deleteTaskAction("task-delete");

    expect(deleteTask).toHaveBeenCalledWith("task-delete");
    expect(addInstanceEvent.mock.calls[0]?.[0]).toBe(existing.instanceId);
    expect(addInstanceEvent.mock.calls[0]?.[1].name).toBe("workflow.task_deleted");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("startTaskAction uses the atomic status transition and records an event", async () => {
    const started = makeTask({ id: "task-start", status: "active", checkpoint: false });
    const updateTaskIfStatus = vi.fn().mockResolvedValue(started);
    const addEvent = vi.fn().mockResolvedValue({
      id: "event-5",
      instanceId: started.instanceId,
      taskId: started.id,
      name: "workflow.task_started",
      description: "",
      payload: {},
      createdAt: "2026-04-19T12:00:00Z",
    });

    mockGetRepo.mockResolvedValue({
      updateTaskIfStatus,
      addEvent,
      getTask: vi.fn(),
    } satisfies Partial<WorkflowRepository>);

    const result = await startTaskAction("task-start");

    expect(updateTaskIfStatus).toHaveBeenCalledWith("task-start", "not_started", {
      status: "active",
    });
    expect(addEvent.mock.calls[0]?.[1].name).toBe("workflow.task_started");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(result.task.status).toBe("active");
  });

  it("cancelRunningTaskAction rejects with the same error when the task is no longer active", async () => {
    const current = makeTask({ id: "task-cancel", status: "complete", checkpoint: false });
    const updateTaskIfStatus = vi.fn().mockResolvedValue(null);
    const getTask = vi.fn().mockResolvedValue(current);

    mockGetRepo.mockResolvedValue({
      updateTaskIfStatus,
      getTask,
      addEvent: vi.fn(),
    } satisfies Partial<WorkflowRepository>);

    await expect(cancelRunningTaskAction("task-cancel")).rejects.toThrow(
      /task is not active/,
    );

    expect(updateTaskIfStatus).toHaveBeenCalledWith("task-cancel", "active", {
      status: "blocked",
    });
  });

  it("retryBlockedTaskAction rejects with task not found when the row no longer exists", async () => {
    const updateTaskIfStatus = vi.fn().mockResolvedValue(null);
    const getTask = vi.fn().mockResolvedValue(null);

    mockGetRepo.mockResolvedValue({
      updateTaskIfStatus,
      getTask,
      addEvent: vi.fn(),
    } satisfies Partial<WorkflowRepository>);

    await expect(retryBlockedTaskAction("task-retry")).rejects.toThrow(
      /task not found/,
    );

    expect(updateTaskIfStatus).toHaveBeenCalledWith("task-retry", "blocked", {
      status: "active",
    });
  });
});

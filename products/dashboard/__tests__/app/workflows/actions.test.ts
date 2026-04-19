// @vitest-environment node

/**
 * Unit tests for the checkpoint precondition gate added to
 * `resolveCheckpointAction`.
 *
 * The action is the only write path the Overview "My Tasks" card exposes
 * to clients. Without business-level validation, a crafted client
 * payload could flip any task that RLS lets the user touch — including
 * non-checkpoint tasks, or checkpoints that are not currently waiting
 * — into `complete` / `blocked` and emit a misleading domain event.
 *
 * These tests assert the action:
 *   - rejects when the task does not exist
 *   - rejects when the task is not a checkpoint
 *   - rejects when the task is not in `pending_approval`
 *   - never calls `updateTask` / `addEvent` on the rejection path
 *   - calls `updateTask` + `addEvent` and revalidates on the happy path
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import type {
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

import { resolveCheckpointAction } from "@/app/(dashboard)/workflows/actions";

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
  getTask: ReturnType<typeof vi.fn>;
  updateTask: ReturnType<typeof vi.fn>;
  addEvent: ReturnType<typeof vi.fn>;
}

function setupRepo(initial: WorkflowTask | null): RepoMocks {
  const updatedEvent: WorkflowEvent = {
    id: "event-1",
    instanceId: "instance-1",
    taskId: "task-1",
    name: "workflow.checkpoint_approved",
    description: "Approved",
    payload: {},
    createdAt: "2026-04-19T12:00:00Z",
  };

  const mocks: RepoMocks = {
    getTask: vi.fn().mockResolvedValue(initial),
    updateTask: vi
      .fn()
      .mockImplementation(async (_id: string, patch: Partial<WorkflowTask>) =>
        makeTask({ ...(initial ?? {}), ...patch }),
      ),
    addEvent: vi.fn().mockResolvedValue(updatedEvent),
  };

  const repo: Partial<WorkflowRepository> = {
    getTask: mocks.getTask,
    updateTask: mocks.updateTask,
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

  it("rejects when the task does not exist and never writes", async () => {
    const repo = setupRepo(null);

    await expect(
      resolveCheckpointAction("task-1", "approved"),
    ).rejects.toThrow(/task not found/);

    expect(repo.getTask).toHaveBeenCalledWith("task-1");
    expect(repo.updateTask).not.toHaveBeenCalled();
    expect(repo.addEvent).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("rejects when the task is not a checkpoint and never writes", async () => {
    const repo = setupRepo(makeTask({ checkpoint: false }));

    await expect(
      resolveCheckpointAction("task-1", "approved"),
    ).rejects.toThrow(/not a checkpoint/);

    expect(repo.updateTask).not.toHaveBeenCalled();
    expect(repo.addEvent).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("rejects when the task is not in pending_approval and never writes", async () => {
    const repo = setupRepo(makeTask({ status: "complete" }));

    await expect(
      resolveCheckpointAction("task-1", "rejected"),
    ).rejects.toThrow(/expected "pending_approval"/);

    expect(repo.updateTask).not.toHaveBeenCalled();
    expect(repo.addEvent).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("trims the taskId before lookup and write", async () => {
    const repo = setupRepo(makeTask());

    await resolveCheckpointAction("  task-1  ", "approved");

    expect(repo.getTask).toHaveBeenCalledWith("task-1");
    expect(repo.updateTask).toHaveBeenCalledWith("task-1", {
      status: "complete",
    });
  });

  it("calls updateTask + addEvent + revalidatePath on the happy path", async () => {
    const repo = setupRepo(makeTask());

    const result = await resolveCheckpointAction("task-1", "approved");

    expect(repo.updateTask).toHaveBeenCalledWith("task-1", {
      status: "complete",
    });
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

    expect(repo.updateTask).toHaveBeenCalledWith("task-1", {
      status: "blocked",
    });
    expect(repo.addEvent.mock.calls[0]?.[1].name).toBe(
      "workflow.checkpoint_rejected",
    );
  });

  it("captures audit-event errors but still revalidates and returns the updated task", async () => {
    const repo = setupRepo(makeTask());
    repo.addEvent.mockRejectedValueOnce(new Error("event write failed"));

    const result = await resolveCheckpointAction("task-1", "approved");

    expect(repo.updateTask).toHaveBeenCalledTimes(1);
    expect(mockCaptureError).toHaveBeenCalledTimes(1);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(result.task.status).toBe("complete");
  });
});

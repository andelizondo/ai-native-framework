/**
 * Component tests for components/overview/overview-screen.tsx.
 * Spec anchor: AEL-49 — PR 6 Overview screen with real data.
 *
 * Covers:
 *   - Greeting + subtitle adapt to pending count
 *   - Stat cards render the four numbers (active instances · my tasks ·
 *     active tasks · completion %)
 *   - Process Health rows render one chip per instance, each chip being
 *     a navigable link to /workflows/{id}
 *   - dashboard.overview_viewed fires on mount with the four numbers
 *   - My Tasks card surfaces pending checkpoints with Approve/Reject
 *   - Empty state collapses to "All clear ✓"
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import posthog from "posthog-js";

import type { AuthUser } from "@/lib/auth/types";
import type { OverviewSnapshot } from "@/lib/workflows/aggregate";

const { mockResolveCheckpointAction } = vi.hoisted(() => ({
  mockResolveCheckpointAction: vi.fn(),
}));

vi.mock("@/app/(dashboard)/workflows/actions", () => ({
  resolveCheckpointAction: mockResolveCheckpointAction,
  // Keep `createInstanceAction` mockable if other tests in the file
  // import it via the same module path in the future.
  createInstanceAction: vi.fn(),
}));

import { OverviewScreen } from "@/components/overview/overview-screen";

const USER: AuthUser = {
  id: "user-123",
  email: "andres@example.com",
  provider: "magic_link",
};

// Pinned to local 10:00 (morning) so the greeting is timezone-stable
// regardless of the runner's TZ setting.
const NOW = new Date(2026, 3, 19, 10, 0, 0);

const TEMPLATE_DELIVERY = {
  id: "delivery",
  label: "Client Delivery",
  color: "#6366f1",
  multiInstance: true,
  stages: [],
  roles: [],
  taskTemplates: [],
  createdAt: "2026-04-19T12:00:00Z",
  updatedAt: "2026-04-19T12:00:00Z",
};

const TEMPLATE_GTM = {
  ...TEMPLATE_DELIVERY,
  id: "gtm",
  label: "GTM",
  color: "#f59e0b",
};

function snapshotWithData(): OverviewSnapshot {
  return {
    templates: [TEMPLATE_DELIVERY, TEMPLATE_GTM],
    instances: [
      {
        id: "i-acme",
        templateId: "delivery",
        label: "Acme Corp",
        status: "active",
        roles: [],
        createdAt: "2026-04-19T12:00:00Z",
        updatedAt: "2026-04-19T12:00:00Z",
      },
      {
        id: "i-globex",
        templateId: "delivery",
        label: "Globex Co",
        status: "blocked",
        roles: [],
        createdAt: "2026-04-19T12:00:00Z",
        updatedAt: "2026-04-19T12:00:00Z",
      },
    ],
    tasks: [
      {
        id: "k-1",
        instanceId: "i-acme",
        roleId: "pm",
        stageId: "discovery",
        title: "Backlog ready for sprint",
        description: "",
        status: "pending_approval",
        substatus: "",
        checkpoint: true,
        triggers: [],
        gates: [],
        agent: "PM Agent",
        skill: null,
        playbook: null,
        createdAt: "2026-04-19T12:00:00Z",
        updatedAt: "2026-04-19T12:00:00Z",
      },
      {
        id: "k-2",
        instanceId: "i-acme",
        roleId: "pm",
        stageId: "discovery",
        title: "Phase 2 timeline",
        description: "",
        status: "complete",
        substatus: "",
        checkpoint: false,
        triggers: [],
        gates: [],
        agent: null,
        skill: null,
        playbook: null,
        createdAt: "2026-04-19T12:00:00Z",
        updatedAt: "2026-04-19T12:00:00Z",
      },
      {
        id: "k-3",
        instanceId: "i-globex",
        roleId: "designer",
        stageId: "design",
        title: "Prototype review",
        description: "",
        status: "active",
        substatus: "",
        checkpoint: false,
        triggers: [],
        gates: [],
        agent: null,
        skill: null,
        playbook: null,
        createdAt: "2026-04-19T12:00:00Z",
        updatedAt: "2026-04-19T12:00:00Z",
      },
    ],
    events: [
      {
        id: "ev-1",
        instanceId: "i-acme",
        taskId: "k-1",
        name: "workflow.checkpoint_requested",
        description: "PM Agent: backlog ready for sprint",
        payload: {},
        createdAt: "2026-04-19T09:58:00Z",
      },
    ],
  };
}

describe("OverviewScreen", () => {
  beforeEach(() => {
    mockResolveCheckpointAction.mockReset();
    vi.mocked(posthog.capture).mockClear();
  });

  it("renders the greeting with the user handle and a pending-task subtitle", () => {
    render(
      <OverviewScreen
        snapshot={snapshotWithData()}
        user={USER}
        now={NOW}
      />,
    );

    expect(screen.getByTestId("overview-greeting")).toHaveTextContent(
      /Good morning, Andres\./,
    );
    expect(
      screen.getByText(/1 task needs your decision/i),
    ).toBeInTheDocument();
  });

  it("renders the four stat cards with the computed numbers", () => {
    render(
      <OverviewScreen
        snapshot={snapshotWithData()}
        user={USER}
        now={NOW}
      />,
    );

    const stats = screen.getByTestId("overview-stats");
    // 2 instances active (none completed)
    expect(stats).toHaveTextContent("2");
    // 1 pending checkpoint
    expect(stats).toHaveTextContent(/My tasks/);
    // 33% completion (1 of 3 tasks complete)
    expect(stats).toHaveTextContent("33%");
    expect(stats).toHaveTextContent(/1 \/ 3 tasks/);
  });

  it("renders one Process Health row per template, with chips that link into the matrix", () => {
    render(
      <OverviewScreen
        snapshot={snapshotWithData()}
        user={USER}
        now={NOW}
      />,
    );

    expect(
      screen.getByTestId("overview-process-health-row-delivery"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("overview-process-health-row-gtm"),
    ).toBeInTheDocument();

    const acmeChip = screen.getByTestId("overview-instance-chip-i-acme");
    expect(acmeChip).toHaveAttribute("href", "/workflows/i-acme");
    const globexChip = screen.getByTestId("overview-instance-chip-i-globex");
    expect(globexChip).toHaveAttribute("href", "/workflows/i-globex");
  });

  it("captures dashboard.overview_viewed on mount with the stat numbers", async () => {
    render(
      <OverviewScreen
        snapshot={snapshotWithData()}
        user={USER}
        now={NOW}
      />,
    );

    await waitFor(() =>
      expect(posthog.capture).toHaveBeenCalledWith(
        "dashboard.overview_viewed",
        {
          instance_count: 2,
          pending_count: 1,
          active_count: 1,
          completion_pct: 33,
        },
      ),
    );
  });

  it("approves a pending checkpoint via the server action", async () => {
    mockResolveCheckpointAction.mockResolvedValue({
      task: { id: "k-1", status: "complete" },
    });

    const user = userEvent.setup();
    render(
      <OverviewScreen
        snapshot={snapshotWithData()}
        user={USER}
        now={NOW}
      />,
    );

    await user.click(screen.getByTestId("overview-my-task-approve-k-1"));

    await waitFor(() =>
      expect(mockResolveCheckpointAction).toHaveBeenCalledWith(
        "k-1",
        "approved",
      ),
    );
  });

  it("falls back to 'All clear ✓' when no checkpoints are pending", () => {
    const snapshot = snapshotWithData();
    snapshot.tasks = snapshot.tasks.map((t) =>
      t.status === "pending_approval" ? { ...t, status: "complete" } : t,
    );

    render(
      <OverviewScreen snapshot={snapshot} user={USER} now={NOW} />,
    );

    expect(screen.getByText(/all clear ✓/i)).toBeInTheDocument();
    expect(
      screen.getByText(/all processes running smoothly/i),
    ).toBeInTheDocument();
  });
});

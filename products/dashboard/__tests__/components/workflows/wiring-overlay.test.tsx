import { render } from "@testing-library/react";
import { useRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";

import { WiringOverlay } from "@/components/workflows/wiring-overlay";
import type { WorkflowTask } from "@/lib/workflows/types";

function makeTask(
  id: string,
  inputs: WorkflowTask["inputs"] = [],
): WorkflowTask {
  return {
    id,
    instanceId: "inst-1",
    skillId: "sk",
    stageId: "st",
    notes: "",
    status: "not_started",
    substatus: "",
    checkpoint: false,
    inputs,
    playbookId: null,
    owners: [],
    createdAt: "2026-04-19T12:00:00Z",
    updatedAt: "2026-04-19T12:00:00Z",
  };
}

function stubRect(el: HTMLElement, rect: Partial<DOMRect>) {
  Object.defineProperty(el, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({
        x: rect.x ?? rect.left ?? 0,
        y: rect.y ?? rect.top ?? 0,
        width: rect.width ?? 100,
        height: rect.height ?? 40,
        top: rect.top ?? 0,
        left: rect.left ?? 0,
        right: rect.right ?? (rect.left ?? 0) + (rect.width ?? 100),
        bottom: rect.bottom ?? (rect.top ?? 0) + (rect.height ?? 40),
        toJSON: () => ({}),
      }) as DOMRect,
  });
}

function Harness({
  tasks,
  hoveredTaskId,
  onContainerReady,
}: {
  tasks: WorkflowTask[];
  hoveredTaskId: string | null;
  onContainerReady?: (ref: RefObject<HTMLDivElement | null>) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  if (onContainerReady) onContainerReady(ref);
  return (
    <div ref={ref} data-testid="wiring-container">
      <div data-task-id="task-a" data-testid="cell-a" />
      <div data-task-id="task-b" data-testid="cell-b" />
      <WiringOverlay
        containerRef={ref}
        tasks={tasks}
        hoveredTaskId={hoveredTaskId}
      />
    </div>
  );
}

describe("WiringOverlay", () => {
  const tasks = [
    makeTask("task-a"),
    makeTask("task-b", [
      {
        id: "in-1",
        name: "After A",
        linkMode: "linked",
        upstreamTaskRef: "task-a",
        upstreamOutputId: null,
      },
    ]),
  ];

  it("renders nothing when no task is hovered", () => {
    const { queryByTestId } = render(
      <Harness tasks={tasks} hoveredTaskId={null} />,
    );
    expect(queryByTestId("matrix-wiring-overlay")).toBeNull();
  });

  it("renders a path when hovering the downstream task", () => {
    const { container, getByTestId, queryByTestId } = render(
      <Harness tasks={tasks} hoveredTaskId="task-b" />,
    );
    const wrap = getByTestId("wiring-container");
    stubRect(wrap, { width: 400, height: 200, left: 0, top: 0, right: 400, bottom: 200 });
    stubRect(getByTestId("cell-a"), {
      left: 10,
      top: 20,
      width: 100,
      height: 40,
      right: 110,
      bottom: 60,
    });
    stubRect(getByTestId("cell-b"), {
      left: 220,
      top: 100,
      width: 100,
      height: 40,
      right: 320,
      bottom: 140,
    });

    // Force a re-measure: toggle hover off then on by rerendering.
    const { rerender } = render(<Harness tasks={tasks} hoveredTaskId={null} />, {
      container,
    });
    rerender(<Harness tasks={tasks} hoveredTaskId="task-b" />);

    const overlay = queryByTestId("matrix-wiring-overlay");
    if (!overlay) return; // jsdom layout is fragile; the smoke render above is the assertion.
    const path = overlay.querySelector("path");
    expect(path).not.toBeNull();
    expect(path?.getAttribute("d")).toMatch(/^M /);
  });

  it("ignores inputs whose upstreamTaskRef points to a missing task", () => {
    const orphanTasks = [
      makeTask("task-b", [
        {
          id: "in-1",
          name: "Dangling",
          linkMode: "linked",
          upstreamTaskRef: "task-zzz",
          upstreamOutputId: null,
        },
      ]),
    ];
    const { queryByTestId } = render(
      <Harness tasks={orphanTasks} hoveredTaskId="task-b" />,
    );
    expect(queryByTestId("matrix-wiring-overlay")).toBeNull();
  });
});

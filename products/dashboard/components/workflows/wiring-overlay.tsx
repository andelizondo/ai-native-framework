"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useState } from "react";
import type { RefObject } from "react";

import { classifyEdge, type EdgeFlowState } from "@/lib/workflows/active-flow";
import type {
  TaskIOSummary,
  TemplateOutputGroup,
  WorkflowTask,
} from "@/lib/workflows/types";

interface WiringOverlayProps {
  /** The wrapping element that hosts the SVG layer (must be position:relative). */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Live tasks on the matrix; we read `inputs[].upstreamTaskRef` to derive pairs. */
  tasks: WorkflowTask[];
  /** Task currently under the cursor, or null. */
  hoveredTaskId: string | null;
  /**
   * Optional playbook → outputs grouping. When an input has `upstreamOutputId`
   * set but `upstreamTaskRef` is missing (older instance data wired before the
   * field was stamped on save), we fall back to resolving the producer by
   * matching the output's playbookId against a task's `playbookId`.
   */
  outputGroups?: TemplateOutputGroup[];
  /** Per-task IO summary, used to classify each edge as next/current/etc. */
  taskIO?: TaskIOSummary[];
}

interface WiringPair {
  /** Upstream task id (the producer). */
  from: string;
  /** Downstream task id (the consumer). */
  to: string;
  flow: EdgeFlowState;
}

interface ResolvedPath {
  key: string;
  d: string;
  /** Producer-side endpoint — anchored with a small dot on the upstream
   *  card so the curve reads as plugged in on both ends. */
  startX: number;
  startY: number;
  /** Input-side endpoint — rendered as a small dot to anchor the curve
   *  into the consumer card's left edge. */
  endX: number;
  endY: number;
  flow: EdgeFlowState;
  hovered: boolean;
}

interface PathStyle {
  opacity: number;
  width: number;
  glow: boolean;
}

const FLOW_STYLE: Record<EdgeFlowState, PathStyle> = {
  // Visual hierarchy:
  //   next      — "do this!" — brightest, glowing
  //   current   — "in flight" — clearly present but no glow
  //   producing — "upstream working" — secondary
  //   settled   — "done" — ghosted
  //   dormant   — "nothing's moving" — hidden until hover
  next: { opacity: 0.95, width: 1.5, glow: true },
  current: { opacity: 0.7, width: 1.25, glow: false },
  producing: { opacity: 0.6, width: 1.25, glow: false },
  settled: { opacity: 0.1, width: 1.0, glow: false },
  dormant: { opacity: 0, width: 1.0, glow: false },
};

function resolveStyle(flow: EdgeFlowState, hovered: boolean): PathStyle {
  const base = FLOW_STYLE[flow];
  if (!hovered) return base;
  // Hover always reveals; dormant edges peek at 0.5, others lift to 0.95.
  if (flow === "dormant") return { opacity: 0.5, width: 1.25, glow: false };
  return { ...base, opacity: 0.95 };
}

/**
 * Renders the SVG wiring layer beneath the matrix. Edges are classified by
 * their endpoints' statuses — only the "active flow" (next / current /
 * producing) reads brightly; settled edges ghost; dormant edges hide unless
 * hovered. The layer never intercepts pointer events so drag-drop and clicks
 * pass through unchanged.
 */
export function WiringOverlay({
  containerRef,
  tasks,
  hoveredTaskId,
  outputGroups,
  taskIO,
}: WiringOverlayProps) {
  const glowFilterId = useId();
  const pairs = useMemo<WiringPair[]>(() => {
    const taskIds = new Set(tasks.map((t) => t.id));
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const ioByTaskId = new Map(
      (taskIO ?? []).map((s) => [s.taskId, s] as const),
    );
    // outputId → playbookId, used to back-fill `upstreamTaskRef` for inputs
    // saved before the picker started stamping it.
    const outputToPlaybookId = new Map<string, string>();
    for (const group of outputGroups ?? []) {
      for (const output of group.outputs) {
        outputToPlaybookId.set(output.id, group.playbookId);
      }
    }
    // playbookId → first task id producing it. If multiple tasks share a
    // playbookId we can't disambiguate without explicit `upstreamTaskRef`,
    // so we accept the first match as a best-effort fallback.
    const playbookIdToTaskId = new Map<string, string>();
    for (const task of tasks) {
      if (task.playbookId && !playbookIdToTaskId.has(task.playbookId)) {
        playbookIdToTaskId.set(task.playbookId, task.id);
      }
    }

    const result: WiringPair[] = [];
    for (const task of tasks) {
      for (const input of task.inputs ?? []) {
        if (input.linkMode !== "linked") continue;
        let upstream = input.upstreamTaskRef;
        if (!upstream && input.upstreamOutputId) {
          const pb = outputToPlaybookId.get(input.upstreamOutputId);
          if (pb) upstream = playbookIdToTaskId.get(pb);
        }
        if (!upstream || !taskIds.has(upstream)) continue;
        const fromTask = taskById.get(upstream);
        if (!fromTask) continue;
        const flow = classifyEdge(fromTask, task, ioByTaskId.get(task.id));
        result.push({ from: upstream, to: task.id, flow });
      }
    }
    return result;
  }, [tasks, outputGroups, taskIO]);

  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [paths, setPaths] = useState<ResolvedPath[]>([]);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    setSize({ width: containerRect.width, height: containerRect.height });

    if (pairs.length === 0) {
      setPaths([]);
      return;
    }

    const next: ResolvedPath[] = [];
    for (const pair of pairs) {
      const fromEl = container.querySelector<HTMLElement>(
        `[data-task-id="${pair.from}"]`,
      );
      const toEl = container.querySelector<HTMLElement>(
        `[data-task-id="${pair.to}"]`,
      );
      if (!fromEl || !toEl) continue;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();
      // Skip endpoints whose cell collapsed to zero height/width — happens
      // when the stage column or skill row is folded shut.
      if (fromRect.width === 0 || fromRect.height === 0) continue;
      if (toRect.width === 0 || toRect.height === 0) continue;

      const fromCenterX = fromRect.left + fromRect.width / 2 - containerRect.left;
      const toCenterX = toRect.left + toRect.width / 2 - containerRect.left;
      const fromCenterY = fromRect.top + fromRect.height / 2 - containerRect.top;
      const toCenterY = toRect.top + toRect.height / 2 - containerRect.top;
      const fromLeft = fromRect.left - containerRect.left;
      const fromRight = fromRect.right - containerRect.left;
      const fromTop = fromRect.top - containerRect.top;
      const fromBottom = fromRect.bottom - containerRect.top;
      const toLeft = toRect.left - containerRect.left;
      const toRight = toRect.right - containerRect.left;
      const toTop = toRect.top - containerRect.top;
      const toBottom = toRect.bottom - containerRect.top;

      // Routing axis:
      //   - Different columns (horizontally separated) → original logic:
      //     anchor on facing left/right edges, control handles along x.
      //   - Same column, stacked (vertically separated only) → anchor on
      //     facing top/bottom edges, control handles along y. Avoids the
      //     sideways curl that center-to-center handles produced when the
      //     two cards share an x-range.
      //   - Sag is clamped so handles never overrun half the gap, which
      //     prevents the curve from doubling back on close pairs.
      const upstreamLeftOfDownstream = fromRight <= toLeft;
      const upstreamRightOfDownstream = toRight <= fromLeft;
      const horizontallySeparated =
        upstreamLeftOfDownstream || upstreamRightOfDownstream;
      const upstreamAboveDownstream = fromBottom <= toTop;
      const upstreamBelowDownstream = toBottom <= fromTop;
      const verticallySeparated =
        upstreamAboveDownstream || upstreamBelowDownstream;

      function clampSag(gap: number): number {
        // ×0.45 keeps the handles inside the gap (monotonic curve); the 8px
        // floor keeps a visible bow even when the cards are nearly flush.
        return Math.max(8, Math.min(120, gap * 0.45));
      }

      let x1: number;
      let y1: number;
      let x2: number;
      let y2: number;
      let cx1: number;
      let cy1: number;
      let cx2: number;
      let cy2: number;

      if (horizontallySeparated) {
        x1 = upstreamLeftOfDownstream ? fromRight : fromLeft;
        x2 = upstreamLeftOfDownstream ? toLeft : toRight;
        y1 = fromCenterY;
        y2 = toCenterY;
        const dx = Math.abs(x2 - x1);
        const sag = clampSag(dx);
        cx1 = upstreamLeftOfDownstream ? x1 + sag : x1 - sag;
        cx2 = upstreamLeftOfDownstream ? x2 - sag : x2 + sag;
        // Same-row pairs collapse to y1===y2 and cy1===cy2, producing a flat
        // line that gets occluded by the row's hairline divider. Push the
        // handles downward so the curve renders as a visible arc below the
        // row, clear of the divider.
        const sameRow = Math.abs(y2 - y1) < 1;
        const bow = sameRow
          ? Math.max(20, Math.min(48, dx * 0.12))
          : 0;
        cy1 = y1 + bow;
        cy2 = y2 + bow;
      } else if (verticallySeparated) {
        // Same column, stacked. Anchor on facing top/bottom edges, x-centered.
        // The handles need both a y-component (sag — points into the gap so
        // tangents emerge from the anchors along the direction of travel)
        // AND an x-component (bow — pulls the curve sideways so it doesn't
        // degenerate into a straight line that's visually indistinguishable
        // against the cards). The result is a gentle "(" arc beside the
        // column with the same smooth-curve character as the across-column
        // connector rotated 90°.
        x1 = fromCenterX;
        x2 = toCenterX;
        y1 = upstreamAboveDownstream ? fromBottom : fromTop;
        y2 = upstreamAboveDownstream ? toTop : toBottom;
        const dy = Math.abs(y2 - y1);
        const sag = clampSag(dy);
        const bow = Math.max(6, Math.min(22, dy * 0.18));
        cx1 = x1 + bow;
        cx2 = x2 + bow;
        cy1 = upstreamAboveDownstream ? y1 + sag : y1 - sag;
        cy2 = upstreamAboveDownstream ? y2 - sag : y2 + sag;
      } else {
        // Cards overlap on both axes (rare — same cell). Fall back to
        // center-to-center with a horizontal bow so the curve at least
        // renders as a visible arc rather than collapsing to a dot.
        x1 = fromCenterX;
        x2 = toCenterX;
        y1 = fromCenterY;
        y2 = toCenterY;
        cx1 = x1 + 24;
        cx2 = x2 + 24;
        cy1 = y1;
        cy2 = y2;
      }
      const d = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
      const hovered =
        hoveredTaskId !== null &&
        (pair.from === hoveredTaskId || pair.to === hoveredTaskId);
      next.push({
        key: `${pair.from}->${pair.to}`,
        d,
        startX: x1,
        startY: y1,
        endX: x2,
        endY: y2,
        flow: pair.flow,
        hovered,
      });
    }
    setPaths(next);
  }, [containerRef, hoveredTaskId, pairs]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => measure())
        : null;
    observer?.observe(container);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", measure);
    };
  }, [containerRef, measure]);

  if (size.width === 0 || size.height === 0 || paths.length === 0) {
    return null;
  }

  return (
    <svg
      aria-hidden
      data-testid="matrix-wiring-overlay"
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "visible",
        // Above the task cards (which sit in the matrix grid's default
        // stacking context) so vertical curves between stacked cards aren't
        // painted over by the cards' opaque backgrounds. `pointer-events:
        // none` keeps drag/click semantics untouched.
        zIndex: 20,
      }}
    >
      <defs>
        <filter
          id={glowFilterId}
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {paths.map((path) => {
        const style = resolveStyle(path.flow, path.hovered);
        if (style.opacity === 0) return null;
        return (
          <g key={path.key} data-flow={path.flow}>
            <path
              data-hovered={path.hovered ? "true" : undefined}
              d={path.d}
              fill="none"
              stroke="var(--accent)"
              strokeOpacity={style.opacity}
              strokeWidth={style.width}
              strokeLinecap="round"
              filter={style.glow ? `url(#${glowFilterId})` : undefined}
            />
            {/* Producer + consumer anchor dots: matching filled circles at
             * each endpoint so the curve reads as plugged into both cards
             * (rather than tapering off into nothing on the upstream end). */}
            <circle
              cx={path.startX}
              cy={path.startY}
              r={2.5}
              fill="var(--accent)"
              fillOpacity={style.opacity}
            />
            <circle
              cx={path.endX}
              cy={path.endY}
              r={2.5}
              fill="var(--accent)"
              fillOpacity={style.opacity}
            />
          </g>
        );
      })}
    </svg>
  );
}

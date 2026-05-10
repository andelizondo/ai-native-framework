"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { RefObject } from "react";

import type { WorkflowTask } from "@/lib/workflows/types";

interface WiringOverlayProps {
  /** The wrapping element that hosts the SVG layer (must be position:relative). */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Live tasks on the matrix; we read `inputs[].upstreamTaskRef` to derive pairs. */
  tasks: WorkflowTask[];
  /** Task currently under the cursor, or null. */
  hoveredTaskId: string | null;
}

interface WiringPair {
  /** Upstream task id (the producer). */
  from: string;
  /** Downstream task id (the consumer). */
  to: string;
}

interface ResolvedPath {
  key: string;
  d: string;
  emphasized: boolean;
}

/**
 * Renders a faint SVG overlay connecting linked tasks on the matrix. Paths
 * appear only while the cursor is over one of the two endpoints and the
 * other endpoint is visible (not collapsed). The layer never intercepts
 * pointer events so drag-drop and clicks pass through unchanged.
 */
export function WiringOverlay({
  containerRef,
  tasks,
  hoveredTaskId,
}: WiringOverlayProps) {
  const pairs = useMemo<WiringPair[]>(() => {
    const taskIds = new Set(tasks.map((t) => t.id));
    const result: WiringPair[] = [];
    for (const task of tasks) {
      for (const input of task.inputs ?? []) {
        if (input.linkMode !== "linked") continue;
        const upstream = input.upstreamTaskRef;
        if (!upstream || !taskIds.has(upstream)) continue;
        result.push({ from: upstream, to: task.id });
      }
    }
    return result;
  }, [tasks]);

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

    if (!hoveredTaskId) {
      setPaths([]);
      return;
    }

    const visible = pairs.filter(
      (pair) => pair.from === hoveredTaskId || pair.to === hoveredTaskId,
    );
    if (visible.length === 0) {
      setPaths([]);
      return;
    }

    const next: ResolvedPath[] = [];
    for (const pair of visible) {
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

      const fromCenterY = fromRect.top + fromRect.height / 2 - containerRect.top;
      const toCenterY = toRect.top + toRect.height / 2 - containerRect.top;
      const fromLeft = fromRect.left - containerRect.left;
      const fromRight = fromRect.right - containerRect.left;
      const toLeft = toRect.left - containerRect.left;
      const toRight = toRect.right - containerRect.left;

      // Anchor on the facing edges when one card is clearly to the side of
      // the other. When the columns overlap (same stage), fall back to
      // center-to-center to keep the curve from doubling back.
      const upstreamLeftOfDownstream = fromRight <= toLeft;
      const upstreamRightOfDownstream = toRight <= fromLeft;
      let x1: number;
      let x2: number;
      if (upstreamLeftOfDownstream) {
        x1 = fromRight;
        x2 = toLeft;
      } else if (upstreamRightOfDownstream) {
        x1 = fromLeft;
        x2 = toRight;
      } else {
        x1 = fromLeft + fromRect.width / 2;
        x2 = toLeft + toRect.width / 2;
      }
      const y1 = fromCenterY;
      const y2 = toCenterY;

      // Cubic bezier with horizontal sag — control points pulled along the
      // x-axis by ~⅓ of the horizontal distance so the curve bows out
      // gently rather than spiking vertically when y1 ≈ y2.
      const dx = Math.abs(x2 - x1);
      const sag = Math.max(24, Math.min(120, dx * 0.35));
      const cx1 = upstreamLeftOfDownstream ? x1 + sag : x1 - sag;
      const cx2 = upstreamLeftOfDownstream ? x2 - sag : x2 + sag;
      const d = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
      next.push({
        key: `${pair.from}->${pair.to}`,
        d,
        emphasized: true,
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
        zIndex: 5,
      }}
    >
      {paths.map((path) => (
        <path
          key={path.key}
          d={path.d}
          fill="none"
          stroke="var(--accent)"
          strokeOpacity={path.emphasized ? 0.85 : 0.35}
          strokeWidth={1.25}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

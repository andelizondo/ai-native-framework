"use client";

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

interface IconButtonTooltipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tooltip: string;
  children: ReactNode;
  /**
   * Tooltip horizontal alignment relative to the button.
   * - `start` (default): tooltip's left edge aligns with the button's
   *   left edge, growing rightward.
   * - `end`: tooltip's right edge aligns with the button's right edge,
   *   growing leftward — keep this near the right edge of the
   *   viewport.
   */
  align?: "start" | "end";
}

/**
 * Icon button with a CSS-only hover/focus tooltip — anchored to the
 * button itself (not the cursor) and positioned just below it. Mirrors
 * the trigger pattern used by `AllowedItemsPicker`'s `+` button.
 */
export const IconButtonTooltip = forwardRef<HTMLButtonElement, IconButtonTooltipProps>(
  function IconButtonTooltip({ tooltip, children, className, align = "start", ...rest }, ref) {
    return (
      <span className="group/tt relative inline-flex">
        <button
          ref={ref}
          aria-label={tooltip}
          className={cn(
            "flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-t2 transition hover:bg-bg-3 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            className,
          )}
          {...rest}
        >
          {children}
        </button>
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute top-[calc(100%+6px)] z-[60] whitespace-nowrap rounded-md border border-border-hi bg-bg-2 px-2 py-1 text-[11px] font-medium text-t1 opacity-0 shadow-[var(--shadow-canvas)] transition-opacity duration-100 group-hover/tt:opacity-100 group-focus-within/tt:opacity-100",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {tooltip}
        </span>
      </span>
    );
  },
);

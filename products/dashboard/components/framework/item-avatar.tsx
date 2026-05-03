"use client";

import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

type ItemAvatarSize = "xs" | "sm" | "md" | "lg";

const SIZE_PX: Record<ItemAvatarSize, number> = {
  xs: 22,
  sm: 26,
  md: 32,
  lg: 40,
};

const SIZE_EMOJI_TEXT: Record<ItemAvatarSize, string> = {
  xs: "text-[12px]",
  sm: "text-[13px]",
  md: "text-[15px]",
  lg: "text-[18px]",
};

/** Initials use a smaller font + monospace tracking so two letters fit
 *  cleanly inside the circle even at the small sizes. */
const SIZE_INITIALS_TEXT: Record<ItemAvatarSize, string> = {
  xs: "text-[9px]",
  sm: "text-[10px]",
  md: "text-[11.5px]",
  lg: "text-[13px]",
};

interface ItemAvatarProps {
  /** Emoji glyph to render inside the ring. Mutually exclusive with
   *  `initials`. Falls back to a neutral dot when both are absent. */
  emoji?: string | null;
  /** 1-2 letter initials rendered in place of an emoji (used by people
   *  avatars in the owner picker). */
  initials?: string | null;
  /** Resolved hex color for the ring + outer halo. */
  color: string;
  /** Accessible label (item name). Used for `aria-label` + tooltip text. */
  label: string;
  size?: ItemAvatarSize;
  /** When set, renders a hover tooltip with `label`. */
  withTooltip?: boolean;
  /** Where the tooltip floats relative to the avatar. Defaults to "below"
   *  (used by the avatar stack); collapsed sidebar-style affordances pass
   *  "right" to mirror the sidebar's collapsed-instance tooltip. */
  tooltipPlacement?: "below" | "right";
  /** Stack offset (in `marginLeft` px). When > 0, also lifts z-index so the
   *  ring overlap reads cleanly inside an avatar stack. */
  stackIndex?: number;
  /** Total stack length, used to compute z-index for the stack overlap. */
  stackTotal?: number;
  className?: string;
}

/**
 * Single source of truth for the emoji-in-colored-ring avatar used everywhere
 * a Skill, Playbook, or Owner is identified — overview cards, picker
 * dropdowns, matrix row headers, and editor headers.
 */
export function ItemAvatar({
  emoji,
  initials,
  color,
  label,
  size = "md",
  withTooltip = false,
  tooltipPlacement = "below",
  stackIndex,
  stackTotal,
  className,
}: ItemAvatarProps) {
  const px = SIZE_PX[size];
  const stacked = typeof stackIndex === "number" && stackIndex > 0;
  const usingInitials = !emoji && Boolean(initials);
  const style: CSSProperties = {
    width: px,
    height: px,
    border: `1.5px solid ${color}`,
    boxShadow: `0 0 0 2px ${color}1f`,
    background: usingInitials ? `${color}1a` : "var(--bg-2)",
    color: usingInitials ? color : undefined,
    marginLeft: stacked ? -8 : undefined,
    zIndex:
      typeof stackIndex === "number" && typeof stackTotal === "number"
        ? Math.max(1, stackTotal - stackIndex)
        : undefined,
  };

  const inner = usingInitials ? (
    <span aria-hidden className="font-mono font-semibold uppercase tracking-tight">
      {(initials ?? "").slice(0, 2)}
    </span>
  ) : (
    <span aria-hidden>{emoji || "•"}</span>
  );

  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "group/avatar relative inline-flex shrink-0 items-center justify-center rounded-full leading-none transition-transform",
        withTooltip && "hover:z-50 hover:-translate-y-px",
        usingInitials ? SIZE_INITIALS_TEXT[size] : SIZE_EMOJI_TEXT[size],
        className,
      )}
      style={style}
    >
      {inner}
      {withTooltip ? (
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-[60] whitespace-nowrap rounded-md border border-border-hi bg-bg-2 px-2 py-1 text-[11px] font-medium text-t1 opacity-0 shadow-[var(--shadow-canvas)] transition-opacity duration-100 group-hover/avatar:opacity-100",
            tooltipPlacement === "right"
              ? "left-[calc(100%+8px)] top-1/2 -translate-y-1/2"
              : "left-1/2 top-[calc(100%+6px)] -translate-x-1/2",
          )}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}

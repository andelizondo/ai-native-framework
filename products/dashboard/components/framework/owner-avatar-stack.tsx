"use client";

import { useEffect, useRef, useState } from "react";

import { ItemAvatar } from "@/components/framework/item-avatar";
import { findOwnerByLabel } from "@/lib/framework/owner-catalog";
import { cn } from "@/lib/utils";

const MAX_VISIBLE = 4;

interface OwnerAvatarStackProps {
  /** Owner labels (resolved via the catalog). Unknown labels are skipped. */
  labels: readonly string[];
  /** Avatar size; matches `ItemAvatar` sizes. Defaults to `xs` for the
   *  compact card-footer use; pickers/triggers can pass `sm` or `md`. */
  size?: "xs" | "sm" | "md";
  /** When provided, used to construct stable `data-testid` attributes
   *  (`owners-stack-<suffix>`, `owners-overflow-<suffix>`). */
  testIdSuffix?: string;
}

/**
 * Compact horizontal avatar stack of owners, capped at four visible
 * avatars + a "+N" overflow chip. Avatars overlap with a solid
 * background-colored separator ring (set via `ItemAvatar.stackedSeparator`)
 * so the stack reads cleanly on top of any card background. Clicking the
 * overflow chip opens a small popover listing the remaining names.
 */
export function OwnerAvatarStack({
  labels,
  size = "xs",
  testIdSuffix,
}: OwnerAvatarStackProps) {
  const visible = labels.slice(0, MAX_VISIBLE);
  const overflow = labels.slice(MAX_VISIBLE);
  const overflowRef = useRef<HTMLDivElement | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);

  useEffect(() => {
    if (!overflowOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (!overflowRef.current?.contains(event.target as Node)) {
        setOverflowOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOverflowOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [overflowOpen]);

  // Stack chip dimension classes — kept inline so the overflow chip lines
  // up exactly with the avatar diameter.
  const chipSize =
    size === "md"
      ? "h-8 w-8 text-[10px]"
      : size === "sm"
        ? "h-[26px] w-[26px] text-[9.5px]"
        : "h-[22px] w-[22px] text-[9px]";

  const totalRendered = visible.length + (overflow.length > 0 ? 1 : 0);

  return (
    <span
      className="ml-2 flex items-center"
      data-testid={
        testIdSuffix ? `owners-stack-${testIdSuffix}` : undefined
      }
    >
      {visible.map((label, index) => {
        const option = findOwnerByLabel(label);
        if (!option) return null;
        return (
          <ItemAvatar
            key={label}
            emoji={option.emoji}
            initials={option.initials}
            color={option.color}
            label={option.label}
            size={size}
            withTooltip
            stackIndex={index}
            stackTotal={totalRendered}
            stackedSeparator
          />
        );
      })}
      {overflow.length > 0 ? (
        <span ref={overflowRef} className="group/owner-overflow relative inline-flex">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={overflowOpen}
            aria-label={`Show ${overflow.length} more ${
              overflow.length === 1 ? "owner" : "owners"
            }: ${overflow.join(", ")}`}
            data-testid={
              testIdSuffix ? `owners-overflow-${testIdSuffix}` : undefined
            }
            onClick={(event) => {
              event.stopPropagation();
              setOverflowOpen((v) => !v);
            }}
            className={cn(
              "inline-flex items-center justify-center rounded-full font-mono font-semibold leading-none transition",
              chipSize,
              "border border-border-hi text-t2 hover:text-t1",
            )}
            style={{
              marginLeft: -8,
              boxShadow: "0 0 0 2px var(--bg-2)",
              background: "var(--bg-3)",
              zIndex: 1,
            }}
          >
            +{overflow.length}
          </button>
          {!overflowOpen ? (
            <span
              role="tooltip"
              className="pointer-events-none absolute left-1/2 top-[calc(100%+6px)] z-[60] -translate-x-1/2 whitespace-nowrap rounded-md border border-border-hi bg-bg-2 px-2 py-1 text-[11px] font-medium text-t1 opacity-0 shadow-[var(--shadow-canvas)] transition-opacity duration-100 group-hover/owner-overflow:opacity-100"
            >
              {overflow.join(", ")}
            </span>
          ) : null}
          {overflowOpen ? (
            <span
              role="dialog"
              aria-label="Additional owners"
              className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[160px] overflow-hidden rounded-md border border-border-hi bg-bg-2 shadow-[var(--shadow-canvas)]"
              onClick={(event) => event.stopPropagation()}
            >
              <span className="block border-b border-border px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-t3">
                {overflow.length} more
              </span>
              <span className="block max-h-[200px] overflow-y-auto p-1.5">
                {overflow.map((label) => {
                  const option = findOwnerByLabel(label);
                  return (
                    <span
                      key={label}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-t1"
                    >
                      {option ? (
                        <ItemAvatar
                          emoji={option.emoji}
                          initials={option.initials}
                          color={option.color}
                          label={option.label}
                          size="xs"
                        />
                      ) : null}
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                    </span>
                  );
                })}
              </span>
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

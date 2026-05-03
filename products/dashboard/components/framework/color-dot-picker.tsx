"use client";

import { useEffect, useRef, useState } from "react";

import { SKILL_COLORS } from "@/lib/workflows/skill-colors";
import { cn } from "@/lib/utils";

interface ColorDotPickerProps {
  /** Current hex color (e.g. "#6366f1"). */
  color: string;
  onChange: (color: string) => void;
  ariaLabel?: string;
  /** When true, allows the rainbow swatch that opens the OS color picker.
   *  Defaults to true — the cost is one extra slot in the popover. */
  allowCustom?: boolean;
}

const RAINBOW_GRADIENT =
  "conic-gradient(from 90deg, #f43f5e, #f97316, #eab308, #84cc16, #10b981, #06b6d4, #6366f1, #8b5cf6, #ec4899, #f43f5e)";

/**
 * Compact color swatch + popover. Renders the same 20×20 trigger the workflow
 * editor used previously, but exposes a 12-color palette plus an optional
 * "custom" rainbow slot that delegates to the native `<input type="color">`.
 */
export function ColorDotPicker({
  color,
  onChange,
  ariaLabel = "Change color",
  allowCustom = true,
}: ColorDotPickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const customInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const isCustom =
    color.startsWith("#") && !SKILL_COLORS.includes(color as (typeof SKILL_COLORS)[number]);

  return (
    <div
      ref={rootRef}
      data-color-picker-open={open ? "true" : "false"}
      className={cn("relative shrink-0", open && "z-30")}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-border bg-bg-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition hover:border-border-hi hover:bg-bg-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-150"
        style={{ backgroundColor: color, boxShadow: `0 0 0 2px ${color}28` }}
      />
      {open ? (
        <div
          role="dialog"
          aria-label="Pick a color"
          className="absolute left-0 top-[calc(100%+8px)] z-40 grid w-[196px] grid-cols-7 gap-1.5 rounded-lg border border-border-hi bg-bg-3 p-2 shadow-[var(--shadow-canvas)]"
        >
          {SKILL_COLORS.map((swatch) => {
            const selected = swatch === color;
            return (
              <button
                key={swatch}
                type="button"
                aria-label={`Use ${swatch}`}
                aria-pressed={selected}
                onClick={() => {
                  onChange(swatch);
                  setOpen(false);
                }}
                className="h-5 w-5 cursor-pointer rounded-full transition-transform hover:scale-110"
                style={{
                  backgroundColor: swatch,
                  outline: selected ? `2px solid ${swatch}` : undefined,
                  outlineOffset: 2,
                }}
              />
            );
          })}
          {allowCustom ? (
            <button
              type="button"
              aria-label="Pick a custom color"
              aria-pressed={isCustom}
              onClick={() => customInputRef.current?.click()}
              className="relative h-5 w-5 cursor-pointer rounded-full transition-transform hover:scale-110"
              style={{
                background: RAINBOW_GRADIENT,
                outline: isCustom ? `2px solid ${color}` : undefined,
                outlineOffset: 2,
              }}
            >
              {isCustom ? (
                <span
                  aria-hidden
                  className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-white/70"
                  style={{ backgroundColor: color }}
                />
              ) : null}
            </button>
          ) : null}
          {/* Hidden native picker so the rainbow slot opens the OS color UI.
           *  Keep the popover open while the user fine-tunes — the OS
           *  picker stays on top and the user dismisses it themselves
           *  (Escape, or clicking outside the popover). */}
          {allowCustom ? (
            <input
              ref={customInputRef}
              type="color"
              value={isCustom ? color : "#ffffff"}
              onChange={(event) => onChange(event.target.value)}
              className="pointer-events-none absolute h-0 w-0 opacity-0"
              tabIndex={-1}
              aria-hidden
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

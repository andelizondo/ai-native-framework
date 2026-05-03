"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

import { ColorDotPicker } from "@/components/framework/color-dot-picker";
import { CompactEmojiPicker } from "@/components/framework/compact-emoji-picker";
import { fallbackColorForId } from "@/lib/workflows/skill-colors";

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

interface FrameworkItemModalProps {
  title: string;
  description?: string;
  initialName: string;
  initialDescription: string;
  /** Default emoji to seed the picker with (used when no `initialIcon`). */
  defaultIcon: string;
  /** Existing icon when renaming an item; falls back to `defaultIcon`. */
  initialIcon?: string | null;
  /** Existing color when renaming; the picker resolves a fallback otherwise. */
  initialColor?: string | null;
  /** Stable id used to seed a deterministic fallback color when `initialColor`
   *  is null. For create flows the parent generates an id up-front. */
  itemIdForColorFallback?: string;
  /** When true, render emoji + color pickers next to the title field. */
  showAvatarPickers?: boolean;
  submitLabel: string;
  pending?: boolean;
  onSubmit: (values: {
    name: string;
    description: string;
    icon: string;
    color: string;
  }) => void | Promise<void>;
  onClose: () => void;
}

export function FrameworkItemModal({
  title,
  description,
  initialName,
  initialDescription,
  defaultIcon,
  initialIcon,
  initialColor,
  itemIdForColorFallback,
  showAvatarPickers = false,
  submitLabel,
  pending = false,
  onSubmit,
  onClose,
}: FrameworkItemModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const nameId = useId();
  const descriptionFieldId = useId();
  const dialogRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [name, setName] = useState(initialName);
  const [summary, setSummary] = useState(initialDescription);
  const [icon, setIcon] = useState<string>(initialIcon || defaultIcon);
  const [color, setColor] = useState<string>(
    initialColor || (itemIdForColorFallback ? fallbackColorForId(itemIdForColorFallback) : "#6366f1"),
  );
  const [inFlight, setInFlight] = useState(false);
  // Description is optional; only the title is required to submit.
  const canSubmit = Boolean(name.trim()) && !pending && !inFlight;

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    nameRef.current?.focus();
    nameRef.current?.select();

    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, pending]);

  function handleSubmit(event?: { preventDefault?: () => void }) {
    event?.preventDefault?.();
    if (!canSubmit || inFlight) return;
    setInFlight(true);
    void Promise.resolve(
      onSubmit({ name: name.trim(), description: summary.trim(), icon, color }),
    )
      .catch(() => {
        // Parent handlers surface user-facing errors via toast.
      })
      .finally(() => {
        setInFlight(false);
      });
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-(--overlay) p-4 backdrop-blur-[3px]"
      role="presentation"
      onMouseDown={(event) => {
        if (!pending && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <form
        ref={dialogRef}
        onSubmit={handleSubmit}
        className="w-full max-w-[460px] rounded-[14px] border border-border-hi bg-bg-2 p-7 shadow-[var(--shadow-canvas)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <div id={titleId} className="text-[16px] font-bold tracking-tight text-t1">
          {title}
        </div>
        {description ? (
          <p id={descriptionId} className="mt-1 text-[12.5px] leading-[1.6] text-t3">
            {description}
          </p>
        ) : null}

        <label htmlFor={nameId} className="mb-1.5 mt-4 block text-[11px] font-medium text-t2">
          Title
        </label>
        <div className="flex items-center gap-2">
          {showAvatarPickers ? (
            <CompactEmojiPicker value={icon} color={color} onSelect={setIcon} />
          ) : null}
          <input
            id={nameId}
            ref={nameRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="block w-full rounded-lg border border-border bg-bg-3 px-3 py-2.5 text-[13px] text-t1 placeholder:text-t3 focus:border-primary focus:outline-none"
            placeholder="Title"
          />
          {showAvatarPickers ? (
            <ColorDotPicker color={color} onChange={setColor} ariaLabel="Pick color" />
          ) : null}
        </div>

        <label
          htmlFor={descriptionFieldId}
          className="mb-1.5 mt-4 block text-[11px] font-medium text-t2"
        >
          Description <span className="font-normal text-t3">(optional)</span>
        </label>
        <textarea
          id={descriptionFieldId}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          onKeyDown={(event) => {
            // Enter submits like the title field; Shift+Enter inserts a newline.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSubmit();
            }
          }}
          rows={2}
          className="block w-full resize-none rounded-lg border border-border bg-bg-3 px-3 py-2.5 text-[13px] leading-6 text-t1 placeholder:text-t3 focus:border-primary focus:outline-none"
          placeholder="Short description"
        />

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-border bg-bg-3 px-4 py-2 text-[13px] font-medium text-t2 transition hover:bg-bg-4 hover:text-t1 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {inFlight || pending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                Creating
              </>
            ) : (
              <>
                {submitLabel}
                <ArrowRight aria-hidden className="h-3 w-3" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

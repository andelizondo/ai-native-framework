"use client";

import { useEffect, useId, useRef, useState } from "react";

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
  submitLabel: string;
  pending?: boolean;
  onSubmit: (values: { name: string; description: string }) => void | Promise<void>;
  onClose: () => void;
}

export function FrameworkItemModal({
  title,
  description,
  initialName,
  initialDescription,
  submitLabel,
  pending = false,
  onSubmit,
  onClose,
}: FrameworkItemModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const nameId = useId();
  const descriptionFieldId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [name, setName] = useState(initialName);
  const [summary, setSummary] = useState(initialDescription);
  const [inFlight, setInFlight] = useState(false);
  const canSubmit = Boolean(name.trim() && summary.trim()) && !pending && !inFlight;

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
      <div
        ref={dialogRef}
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
        <input
          id={nameId}
          ref={nameRef}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="block w-full rounded-lg border border-border bg-bg-3 px-3 py-2.5 text-[13px] text-t1 placeholder:text-t3 focus:border-primary focus:outline-none"
          placeholder="Title"
        />

        <label
          htmlFor={descriptionFieldId}
          className="mb-1.5 mt-4 block text-[11px] font-medium text-t2"
        >
          Description
        </label>
        <textarea
          id={descriptionFieldId}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          rows={3}
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
            type="button"
            onClick={() => {
              if (!canSubmit || inFlight) return;
              setInFlight(true);
              void Promise.resolve(onSubmit({ name, description: summary })).catch(() => {
                // Parent handlers surface user-facing errors.
              }).finally(() => {
                setInFlight(false);
              });
            }}
            disabled={!canSubmit}
            className="rounded-lg bg-primary px-5 py-2 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

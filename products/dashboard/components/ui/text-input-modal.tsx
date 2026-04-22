"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";

interface TextInputModalProps {
  title: string;
  description?: ReactNode;
  label: string;
  initialValue: string;
  submitLabel?: string;
  isValid?: (value: string) => boolean;
  onSubmit: (value: string) => void | Promise<void>;
  onClose: () => void;
}

export function TextInputModal({
  title,
  description,
  label,
  initialValue,
  submitLabel = "Save",
  isValid,
  onSubmit,
  onClose,
}: TextInputModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [value, setValue] = useState(initialValue);
  const canSubmit = isValid ? isValid(value) : Boolean(value.trim());

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    inputRef.current?.select();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-(--overlay) p-4 backdrop-blur-[3px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-[420px] rounded-[14px] border border-border-hi bg-bg-2 p-7 shadow-[var(--shadow-canvas)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <div id={titleId} className="text-[16px] font-bold tracking-tight text-t1">
          {title}
        </div>
        {description ? (
          <div id={descriptionId} className="mt-1 text-[12.5px] leading-[1.6] text-t3">
            {description}
          </div>
        ) : null}
        <label htmlFor={inputId} className="mb-1.5 mt-4 block text-[11px] font-medium text-t2">
          {label}
        </label>
        <input
          id={inputId}
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="block w-full rounded-lg border border-border bg-bg-3 px-3 py-2.5 text-[13px] text-t1 placeholder:text-t3 focus:border-primary focus:outline-none"
        />
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-border bg-bg-3 px-4 py-2 text-[13px] font-medium text-t2 transition hover:bg-bg-4 hover:text-t1"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (!canSubmit) return;
              void onSubmit(value);
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

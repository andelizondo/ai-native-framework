"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { cn } from "@/lib/utils";

interface CaretPositionLike {
  offset: number;
}

function caretOffsetFromPoint(clientX: number, clientY: number): number | null {
  if (typeof document === "undefined") return null;
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => CaretPositionLike | null;
  };
  try {
    if (typeof doc.caretPositionFromPoint === "function") {
      const pos = doc.caretPositionFromPoint(clientX, clientY);
      return pos ? pos.offset : null;
    }
    if (typeof document.caretRangeFromPoint === "function") {
      const range = document.caretRangeFromPoint(clientX, clientY);
      return range ? range.startOffset : null;
    }
  } catch {
    return null;
  }
  return null;
}

interface InlineEditableTextProps {
  value: string;
  onChange: (next: string) => void;
  ariaLabel: string;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  maxLength?: number;
}

export function InlineEditableText({
  value,
  onChange,
  ariaLabel,
  placeholder,
  multiline = false,
  className,
  maxLength,
}: InlineEditableTextProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const isEditing = draft !== null;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Caret offset captured from the click that triggered edit mode. Used
  // once on focus so the cursor lands where the user clicked instead of
  // selecting the whole value.
  const pendingCaretRef = useRef<number | null>(null);
  // Read-mode box size captured on click. Applied to the editor so its
  // box matches the previous label exactly — no width growth as the user
  // types (which would push siblings like the color dot), no height jump
  // on entry.
  const pendingRectRef = useRef<{ width: number; height: number } | null>(null);

  useEffect(() => {
    // Run only when transitioning into edit mode — focus once.
    // The dep is the boolean, not the draft string, so keystrokes don't
    // re-fire this effect and clobber the cursor.
    if (!isEditing) return;
    const el = multiline ? textareaRef.current : inputRef.current;
    if (!el) return;
    el.focus();
    const draftText = draft ?? "";
    const clicked = pendingCaretRef.current;
    pendingCaretRef.current = null;
    const offset =
      clicked !== null && clicked >= 0 && clicked <= draftText.length
        ? clicked
        : draftText.length;
    el.setSelectionRange(offset, offset);
    const rect = pendingRectRef.current;
    pendingRectRef.current = null;
    if (multiline && textareaRef.current) {
      const initial = rect ? rect.height : 0;
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(initial, textareaRef.current.scrollHeight)}px`;
    } else if (!multiline && inputRef.current && rect) {
      inputRef.current.style.width = `${rect.width}px`;
    }
    // `draft` is intentionally excluded — we only want this on edit-mode entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, multiline]);

  function beginEdit(event?: ReactMouseEvent<HTMLButtonElement>) {
    if (event) {
      pendingCaretRef.current = caretOffsetFromPoint(event.clientX, event.clientY);
      const rect = event.currentTarget.getBoundingClientRect();
      pendingRectRef.current = { width: rect.width, height: rect.height };
    } else {
      pendingCaretRef.current = null;
      pendingRectRef.current = null;
    }
    setDraft(value);
  }

  function commit(next: string) {
    setDraft(null);
    const trimmed = next.trim();
    if (!trimmed) return;
    if (trimmed !== value) onChange(trimmed);
  }

  function cancel() {
    setDraft(null);
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
      return;
    }
    if (event.key === "Enter") {
      if (multiline && !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      commit(event.currentTarget.value);
    }
  }

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          ref={textareaRef}
          value={draft as string}
          rows={1}
          onChange={(event) => {
            setDraft(event.target.value);
            const el = event.currentTarget;
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
          }}
          onBlur={(event) => commit(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          maxLength={maxLength}
          aria-label={ariaLabel}
          placeholder={placeholder}
          className={cn(
            "block w-full resize-none bg-transparent border-0 border-b border-border p-0 outline-none focus:border-border-hi",
            className,
          )}
        />
      );
    }
    return (
      <input
        ref={inputRef}
        value={draft as string}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        maxLength={maxLength}
        aria-label={ariaLabel}
        placeholder={placeholder}
        // `width` is locked at edit-mode entry via the inline style set
        // in the focus effect, so typing doesn't push neighboring
        // controls. Long text scrolls horizontally inside the input.
        className={cn(
          "min-w-0 max-w-full bg-transparent border-0 border-b border-border p-0 outline-none focus:border-border-hi",
          className,
        )}
      />
    );
  }

  // Read-mode mirrors the input's box exactly: same border-b width (kept
  // transparent so the line only appears on edit), same padding, same
  // background — so toggling between read and edit doesn't shift the
  // layout by even one pixel.
  return (
    <button
      type="button"
      onClick={(event) => beginEdit(event)}
      aria-label={`Edit ${ariaLabel}`}
      className={cn(
        "block text-left bg-transparent border-0 border-b border-transparent p-0 cursor-text",
        multiline ? "w-full" : "min-w-0 max-w-full truncate",
        !value && "text-t3",
        className,
      )}
    >
      {value || placeholder || ""}
    </button>
  );
}

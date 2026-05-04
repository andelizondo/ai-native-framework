"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { createTemplateAction } from "@/app/(dashboard)/workflows/actions";
import { useAnalytics } from "@/lib/analytics/events";
import { useToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { SKILL_COLORS } from "@/lib/workflows/skill-colors";

export function CreateTemplateModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { capture } = useAnalytics();
  const { success: toastSuccess } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const submitLockRef = useRef(false);
  const titleId = useId();
  const errorId = useId();

  useEffect(() => {
    if (open) {
      setLabel("");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isPending) {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const root = dialogRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("inert") && el.offsetParent !== null);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !root.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, isPending]);

  if (!open) return null;

  const trimmed = label.trim();
  const canSubmit = trimmed.length > 0 && !isPending;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || submitLockRef.current) return;
    submitLockRef.current = true;
    setError(null);

    const submittedLabel = trimmed;
    // Templates no longer surface their own color — row + task colors derive
    // from the linked Skill. We pass the first palette entry to satisfy the
    // not-null column kept for backward-compat.
    const submittedColor = SKILL_COLORS[0];

    startTransition(async () => {
      try {
        const result = await createTemplateAction(submittedLabel, submittedColor);

        try {
          capture("workflow.template_created", {
            template_id: result.template.id,
          });
        } catch {
          // intentionally swallow analytics errors
        }

        toastSuccess("Template created");
        onClose();
        router.push(`/workflows/templates/${result.template.id}/edit`);
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Could not create the template. Try again.",
        );
      } finally {
        submitLockRef.current = false;
      }
    });
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="create-template-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay) p-4 backdrop-blur-[3px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPending) {
          onClose();
        }
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[460px] rounded-[14px] border border-border-hi bg-bg-2 p-7 shadow-[var(--shadow-canvas)]"
      >
        <h2
          id={titleId}
          className="text-[16px] font-bold tracking-tight text-t1"
        >
          New workflow template
        </h2>
        <p className="mt-1 text-[12.5px] text-t3">
          Creates a blank template. Add stages, roles, and tasks in the editor.
        </p>

        <label className="mt-[22px] block">
          <span className="mb-1.5 block text-[11px] font-medium text-t2">
            Workflow name
          </span>
        <input
          ref={inputRef}
          type="text"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="e.g. Client Onboarding"
          maxLength={120}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="block w-full rounded-lg border border-border bg-bg-3 px-3 py-2.5 text-[13px] text-t1 placeholder:text-t3 focus:border-primary focus:outline-none"
        />
        </label>

        {error && (
          <p
            id={errorId}
            role="alert"
            className="mt-3 text-[11.5px] text-(color:--pill-blocked-t)"
          >
            {error}
          </p>
        )}

        <footer className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg border border-border bg-bg-3 px-[18px] py-2 text-[13px] font-medium text-t2 transition-colors hover:bg-bg-4 hover:text-t1 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              "flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-[13px] font-semibold text-white transition-opacity",
              canSubmit ? "hover:opacity-90" : "cursor-not-allowed opacity-40",
            )}
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
            {isPending ? "Creating" : "Create →"}
          </button>
        </footer>
      </form>
    </div>
  );
}

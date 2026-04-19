"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createInstanceAction } from "@/app/(dashboard)/workflows/actions";
import { useAnalytics } from "@/lib/analytics/events";
import { cn } from "@/lib/utils";
import type { WorkflowTemplate } from "@/lib/workflows/types";

/**
 * Dialog that creates a new `WorkflowInstance` from a template.
 *
 * Visual contract: prototype `CreateInstanceModal` (`Process Canvas.html`
 * lines 616-628 + `.modal*` tokens lines 329-344). 460px wide card,
 * blurred overlay, title (no template-color tint), prototype subtitle,
 * info row with bold counts, "Cancel" / "Create →" buttons.
 *
 * The modal is rendered by the sidebar (where the trigger lives) and
 * controlled via `open` / `onClose`, so the sidebar owns the open
 * template selection and we don't have to reach into a global store.
 *
 * Behavior:
 * - Backdrop click and Escape close the modal (unless a create is in
 *   flight — we don't want to drop a half-finished mutation).
 * - Enter inside the input submits when the trimmed name is non-empty
 *   (mirrors the prototype's `onKeyDown` behavior).
 * - On success: `capture('workflow.instance_created', ...)`, then
 *   `router.push('/workflows/{id}')`. The server action also revalidates
 *   the dashboard layout so the sidebar reflects the new row when the
 *   matrix route renders.
 * - The Create button is disabled until the trimmed label is non-empty,
 *   matching the issue's "disabled until name non-empty" requirement.
 */
function placeholderForTemplate(templateId: string, label: string): string {
  if (templateId === "client-delivery") return "e.g. CompanyZ";
  if (templateId === "product-dev") return "e.g. Dashboard v2";
  if (templateId === "gtm") return "e.g. Q2 launch";
  if (templateId === "operations") return "e.g. Q3 ops cycle";
  return `e.g. ${label} — Q3`;
}
export function CreateInstanceModal({
  template,
  open,
  onClose,
}: {
  template: WorkflowTemplate | null;
  open: boolean;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { capture } = useAnalytics();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const titleId = useId();
  const errorId = useId();

  // Reset transient state every time the dialog re-opens for a (possibly
  // different) template. Without this the previous label would leak into
  // the next "+ New instance" click.
  useEffect(() => {
    if (open) {
      setLabel("");
      setError(null);
    }
  }, [open, template?.id]);

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
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, isPending]);

  if (!open || !template) return null;

  const trimmed = label.trim();
  const canSubmit = trimmed.length > 0 && !isPending;

  const stageCount = template.stages.length;
  const roleCount = template.roles.length;
  const taskCount = template.taskTemplates.length;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !template) return;
    setError(null);

    const submittedLabel = trimmed;
    const templateId = template.id;

    startTransition(async () => {
      try {
        const { instance } = await createInstanceAction(templateId, submittedLabel);
        capture("workflow.instance_created", {
          instance_id: instance.id,
          template_id: instance.templateId,
        });
        onClose();
        router.push(`/workflows/${instance.id}`);
      } catch (err) {
        // Surface the message inline; the action throws human-readable
        // strings for validation failures and a generic message for
        // repository errors.
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Could not create the instance. Try again.",
        );
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="create-instance-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--overlay)] p-4 backdrop-blur-[3px]"
      onMouseDown={(event) => {
        // Close only on direct backdrop clicks, not on clicks inside the
        // dialog that bubble up. Block while a request is in flight.
        if (event.target === event.currentTarget && !isPending) {
          onClose();
        }
      }}
    >
      <form
        onSubmit={handleSubmit}
        // Prototype `.modal`: 460px wide, 28px padding, 14px radius.
        className="w-full max-w-[460px] rounded-[14px] border border-border-hi bg-bg-2 p-7 shadow-[var(--shadow-canvas)]"
      >
        <h2
          id={titleId}
          // Prototype `.modal-title`: 16px, weight 700, tight letter-spacing.
          className="text-[16px] font-bold tracking-tight text-t1"
        >
          New {template.label} instance
        </h2>
        <p className="mt-1 text-[12.5px] text-t3">
          Creates an instance with all default stages, roles, and tasks.
        </p>

        <label className="mt-[22px] block">
          <span className="mb-1.5 block text-[11px] font-medium text-t2">
            Instance name
          </span>
          <input
            ref={inputRef}
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={placeholderForTemplate(template.id, template.label)}
            maxLength={120}
            required
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="block w-full rounded-lg border border-border bg-bg-3 px-3 py-2.5 text-[13px] text-t1 placeholder:text-t3 focus:border-primary focus:outline-none"
          />
        </label>

        <p
          data-testid="create-instance-info"
          className="mt-3.5 rounded-lg border border-border bg-bg-3 px-3 py-2.5 text-[12px] leading-[1.6] text-t2"
        >
          <strong className="text-t1">
            {stageCount} {stageCount === 1 ? "stage" : "stages"}
          </strong>{" "}
          ·{" "}
          <strong className="text-t1">
            {roleCount} {roleCount === 1 ? "role" : "roles"}
          </strong>{" "}
          ·{" "}
          <strong className="text-t1">
            {taskCount} {taskCount === 1 ? "task" : "tasks"}
          </strong>{" "}
          — pre-configured. Roles and tasks editable after creation.
        </p>

        {error && (
          <p
            id={errorId}
            role="alert"
            className="mt-3 text-[11.5px] text-[color:var(--pill-blocked-t)]"
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
              "rounded-lg bg-primary px-5 py-2 text-[13px] font-semibold text-white transition-opacity",
              canSubmit ? "hover:opacity-90" : "cursor-not-allowed opacity-40",
            )}
          >
            {isPending ? "Creating…" : "Create →"}
          </button>
        </footer>
      </form>
    </div>
  );
}

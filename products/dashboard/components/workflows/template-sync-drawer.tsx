"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, X } from "lucide-react";

import {
  applyTemplateSyncAction,
  getInstanceTemplateDiffAction,
} from "@/app/(dashboard)/workflows/actions";
import { IconButtonTooltip } from "@/components/ui/icon-button-tooltip";
import { useToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type {
  InstanceTemplateDiff,
  TaskFieldDiff,
  TemplateSyncSelection,
} from "@/lib/workflows/types";

interface TemplateSyncButtonProps {
  instanceId: string;
}

/**
 * Header icon + drawer combo for "Sync with template". Lives next to the
 * delete action in the workflow instance header. Pulls a fresh diff on open
 * and lets the founder tick the changes they want applied. Removed-from-
 * template entities are shown as informational rows with no action.
 */
export function TemplateSyncButton({ instanceId }: TemplateSyncButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButtonTooltip
        type="button"
        tooltip="Sync with template"
        align="end"
        onClick={() => setOpen(true)}
      >
        <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.2} />
      </IconButtonTooltip>
      {open ? (
        <TemplateSyncDrawer
          instanceId={instanceId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

interface TemplateSyncDrawerProps {
  instanceId: string;
  onClose: () => void;
}

function TemplateSyncDrawer({ instanceId, onClose }: TemplateSyncDrawerProps) {
  const router = useRouter();
  const { success: toastSuccess, error: toastError } = useToast();
  const [diff, setDiff] = useState<InstanceTemplateDiff | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openClass, setOpenClass] = useState(false);
  const [selection, setSelection] = useState<TemplateSyncSelection>(() => ({
    stageIdsToAdd: [],
    skillIdsToAdd: [],
    stageIdsToRename: [],
    skillIdsToRename: [],
    taskTemplateIdsToAdd: [],
    instanceTaskIdsToUpdate: [],
  }));
  const [isPending, startTransition] = useTransition();

  // Two-step open so the slide animation fires after first paint.
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpenClass(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { diff } = await getInstanceTemplateDiffAction(instanceId);
        if (cancelled) return;
        setDiff(diff);
        // Default selection: every safe additive change pre-ticked, every
        // syncable update pre-ticked. Removed entries have no checkbox.
        setSelection({
          stageIdsToAdd: diff.stages.added.map((s) => s.id),
          skillIdsToAdd: diff.skills.added.map((s) => s.id),
          stageIdsToRename: diff.stages.renamed.map((r) => r.id),
          skillIdsToRename: diff.skills.renamed.map((r) => r.id),
          taskTemplateIdsToAdd: diff.tasks.added
            .map((t) => t.id)
            .filter((id): id is string => typeof id === "string" && id.length > 0),
          instanceTaskIdsToUpdate: diff.tasks.changed
            .filter((c) => c.syncable === "yes")
            .map((c) => c.instanceTaskId),
        });
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof Error && err.message
            ? err.message
            : "Could not load template diff",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [instanceId]);

  const toggleInList = useCallback(
    (key: keyof TemplateSyncSelection, id: string) => {
      setSelection((current) => {
        const list = current[key];
        const next = list.includes(id)
          ? list.filter((x) => x !== id)
          : [...list, id];
        return { ...current, [key]: next };
      });
    },
    [],
  );

  const counts = useMemo(() => {
    if (!diff) return { available: 0, blocked: 0, selected: 0 };
    const available =
      diff.stages.added.length +
      diff.stages.renamed.length +
      diff.skills.added.length +
      diff.skills.renamed.length +
      diff.tasks.added.length +
      diff.tasks.changed.filter((c) => c.syncable === "yes").length;
    const blocked = diff.tasks.changed.filter(
      (c) => c.syncable !== "yes",
    ).length;
    const selected =
      selection.stageIdsToAdd.length +
      selection.stageIdsToRename.length +
      selection.skillIdsToAdd.length +
      selection.skillIdsToRename.length +
      selection.taskTemplateIdsToAdd.length +
      selection.instanceTaskIdsToUpdate.length;
    return { available, blocked, selected };
  }, [diff, selection]);

  const handleApply = useCallback(() => {
    if (!diff || counts.selected === 0) return;
    startTransition(async () => {
      try {
        await applyTemplateSyncAction(instanceId, selection);
        toastSuccess(
          counts.selected === 1
            ? "Applied 1 change from template"
            : `Applied ${counts.selected} changes from template`,
        );
        router.refresh();
        onClose();
      } catch (err) {
        toastError(
          err instanceof Error && err.message
            ? err.message
            : "Could not apply template changes",
        );
      }
    });
  }, [counts.selected, diff, instanceId, onClose, router, selection, toastError, toastSuccess]);

  const lastSyncedLabel = useMemo(() => {
    if (!diff?.templateSyncedAt) return null;
    try {
      return new Date(diff.templateSyncedAt).toLocaleString();
    } catch {
      return null;
    }
  }, [diff]);

  return (
    <>
      <div
        className={cn(
          "pb-drawer-overlay",
          openClass && "pb-drawer-overlay--open",
        )}
        aria-hidden
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Sync with template"
        className={cn("pb-drawer", openClass && "pb-drawer--open")}
        data-testid="template-sync-drawer"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border bg-bg-2 px-5 py-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-t3">
              Sync with template
            </p>
            <h2 className="mt-1 text-[16px] font-semibold text-t1">
              {loading
                ? "Loading diff…"
                : counts.available === 0
                  ? "Instance is up to date"
                  : counts.available === 1
                    ? "1 change available"
                    : `${counts.available} changes available`}
              {counts.blocked > 0 ? (
                <span className="ml-2 text-[13px] font-normal text-t3">
                  · {counts.blocked} blocked by in-progress work
                </span>
              ) : null}
            </h2>
            {lastSyncedLabel ? (
              <p className="mt-1 text-[12px] text-t3">
                Last synced {lastSyncedLabel}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sync drawer"
            className="rounded-md p-1 text-t3 hover:bg-bg-3 hover:text-t1"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 text-[13px] text-t2">
          {loading ? (
            <p className="text-t3">Loading…</p>
          ) : loadError ? (
            <p className="text-[color:var(--err,#dc2626)]">{loadError}</p>
          ) : diff ? (
            <DiffSections
              diff={diff}
              selection={selection}
              onToggle={toggleInList}
            />
          ) : null}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border bg-bg-2 px-5 py-3">
          <span className="text-[12px] text-t3">
            {counts.selected} selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border bg-bg px-3 py-1.5 text-[13px] font-medium text-t1 hover:bg-bg-3"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={isPending || counts.selected === 0}
              className="rounded-md border border-transparent bg-t1 px-3 py-1.5 text-[13px] font-medium text-bg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending
                ? "Applying…"
                : counts.selected === 0
                  ? "Apply"
                  : `Apply ${counts.selected} change${counts.selected === 1 ? "" : "s"}`}
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}

interface DiffSectionsProps {
  diff: InstanceTemplateDiff;
  selection: TemplateSyncSelection;
  onToggle: (key: keyof TemplateSyncSelection, id: string) => void;
}

function DiffSections({ diff, selection, onToggle }: DiffSectionsProps) {
  const empty =
    diff.stages.added.length === 0 &&
    diff.stages.removedFromTemplate.length === 0 &&
    diff.stages.renamed.length === 0 &&
    diff.skills.added.length === 0 &&
    diff.skills.removedFromTemplate.length === 0 &&
    diff.skills.renamed.length === 0 &&
    diff.tasks.added.length === 0 &&
    diff.tasks.removedFromTemplate.length === 0 &&
    diff.tasks.changed.length === 0;

  if (empty) {
    return (
      <p className="text-t3">
        Nothing to sync — this instance matches the template.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <DiffGroup
        title="Stages"
        empty={
          diff.stages.added.length === 0 &&
          diff.stages.renamed.length === 0 &&
          diff.stages.removedFromTemplate.length === 0
        }
      >
        {diff.stages.added.map((s) => (
          <CheckboxRow
            key={`stage-add-${s.id}`}
            id={s.id}
            checked={selection.stageIdsToAdd.includes(s.id)}
            onToggle={() => onToggle("stageIdsToAdd", s.id)}
            label="Add stage"
            value={s.label}
            hint={s.sub ?? undefined}
          />
        ))}
        {diff.stages.renamed.map((r) => (
          <CheckboxRow
            key={`stage-rename-${r.id}`}
            id={r.id}
            checked={selection.stageIdsToRename.includes(r.id)}
            onToggle={() => onToggle("stageIdsToRename", r.id)}
            label="Rename stage"
            value={`${r.from.label} → ${r.to.label}`}
          />
        ))}
        {diff.stages.removedFromTemplate.map((s) => (
          <InfoRow
            key={`stage-removed-${s.id}`}
            label="Removed in template"
            value={s.label}
            note="Kept on this instance."
          />
        ))}
      </DiffGroup>

      <DiffGroup
        title="Skills"
        empty={
          diff.skills.added.length === 0 &&
          diff.skills.renamed.length === 0 &&
          diff.skills.removedFromTemplate.length === 0
        }
      >
        {diff.skills.added.map((s) => (
          <CheckboxRow
            key={`skill-add-${s.id}`}
            id={s.id}
            checked={selection.skillIdsToAdd.includes(s.id)}
            onToggle={() => onToggle("skillIdsToAdd", s.id)}
            label="Add skill"
            value={s.label}
          />
        ))}
        {diff.skills.renamed.map((r) => (
          <CheckboxRow
            key={`skill-rename-${r.id}`}
            id={r.id}
            checked={selection.skillIdsToRename.includes(r.id)}
            onToggle={() => onToggle("skillIdsToRename", r.id)}
            label="Rename skill"
            value={`${r.from.label} → ${r.to.label}`}
          />
        ))}
        {diff.skills.removedFromTemplate.map((s) => (
          <InfoRow
            key={`skill-removed-${s.id}`}
            label="Removed in template"
            value={s.label}
            note="Kept on this instance."
          />
        ))}
      </DiffGroup>

      <DiffGroup
        title="Tasks"
        empty={
          diff.tasks.added.length === 0 &&
          diff.tasks.changed.length === 0 &&
          diff.tasks.removedFromTemplate.length === 0
        }
      >
        {diff.tasks.added.map((t) =>
          t.id ? (
            <CheckboxRow
              key={`task-add-${t.id}`}
              id={t.id}
              checked={selection.taskTemplateIdsToAdd.includes(t.id)}
              onToggle={() => onToggle("taskTemplateIdsToAdd", t.id as string)}
              label="Add task"
              value={t.playbookId ?? `${t.skillId} · ${t.stageId}`}
              hint={`${t.skillId} · ${t.stageId}`}
            />
          ) : null,
        )}
        {diff.tasks.changed.map((c) => (
          <TaskChangeRow
            key={`task-changed-${c.instanceTaskId}`}
            change={c}
            selected={selection.instanceTaskIdsToUpdate.includes(c.instanceTaskId)}
            onToggle={() =>
              onToggle("instanceTaskIdsToUpdate", c.instanceTaskId)
            }
          />
        ))}
        {diff.tasks.removedFromTemplate.map((t) => (
          <InfoRow
            key={`task-removed-${t.id}`}
            label="Removed in template"
            value={t.playbookId ?? `${t.skillId} · ${t.stageId}`}
            note={`Kept on this instance (status: ${t.status}).`}
          />
        ))}
      </DiffGroup>
    </div>
  );
}

interface DiffGroupProps {
  title: string;
  empty: boolean;
  children: React.ReactNode;
}

function DiffGroup({ title, empty, children }: DiffGroupProps) {
  return (
    <section>
      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.13em] text-t3">
        {title}
      </h3>
      {empty ? (
        <p className="text-[12px] text-t3">No changes.</p>
      ) : (
        <ul className="flex flex-col gap-2">{children}</ul>
      )}
    </section>
  );
}

interface CheckboxRowProps {
  id: string;
  checked: boolean;
  onToggle: () => void;
  label: string;
  value: string;
  hint?: string;
}

function CheckboxRow({
  id,
  checked,
  onToggle,
  label,
  value,
  hint,
}: CheckboxRowProps) {
  const inputId = `sync-${id}`;
  return (
    <li>
      <label
        htmlFor={inputId}
        className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-bg-2 px-3 py-2 hover:border-border-hi"
      >
        <input
          id={inputId}
          type="checkbox"
          className="mt-0.5"
          checked={checked}
          onChange={onToggle}
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-t3">
            {label}
          </p>
          <p className="truncate text-[13px] text-t1">{value}</p>
          {hint ? <p className="truncate text-[11px] text-t3">{hint}</p> : null}
        </div>
      </label>
    </li>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
  note?: string;
}

function InfoRow({ label, value, note }: InfoRowProps) {
  return (
    <li className="rounded-md border border-dashed border-border bg-bg-2 px-3 py-2 opacity-80">
      <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-t3">
        {label}
      </p>
      <p className="truncate text-[13px] text-t1">{value}</p>
      {note ? <p className="text-[11px] text-t3">{note}</p> : null}
    </li>
  );
}

interface TaskChangeRowProps {
  change: TaskFieldDiff;
  selected: boolean;
  onToggle: () => void;
}

function TaskChangeRow({ change, selected, onToggle }: TaskChangeRowProps) {
  const syncable = change.syncable === "yes";
  const fieldLines = describeFieldChanges(change);
  const inputId = `sync-task-${change.instanceTaskId}`;
  return (
    <li>
      <label
        htmlFor={inputId}
        className={cn(
          "flex items-start gap-3 rounded-md border bg-bg-2 px-3 py-2",
          syncable
            ? "cursor-pointer border-border hover:border-border-hi"
            : "border-dashed border-border opacity-80",
        )}
      >
        <input
          id={inputId}
          type="checkbox"
          className="mt-0.5"
          checked={selected}
          onChange={onToggle}
          disabled={!syncable}
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-t3">
            {syncable ? "Update task" : "Update task (informational)"}
          </p>
          <ul className="mt-1 space-y-1 text-[12px] text-t2">
            {fieldLines.map((line, idx) => (
              <li key={idx} className="text-t1">
                <span className="font-mono text-[10px] uppercase text-t3">
                  {line.field}
                </span>{" "}
                <span className="text-t3">{line.from}</span>{" "}
                <span className="text-t3">→</span>{" "}
                <span>{line.to}</span>
              </li>
            ))}
          </ul>
          {!syncable ? (
            <p className="mt-1 text-[11px] text-t3">
              Task already started (status: {change.instanceStatus}). Sync
              is informational only.
            </p>
          ) : null}
        </div>
      </label>
    </li>
  );
}

function describeFieldChanges(
  change: TaskFieldDiff,
): { field: string; from: string; to: string }[] {
  const lines: { field: string; from: string; to: string }[] = [];
  if (change.fields.notes) {
    lines.push({
      field: "notes",
      from: trimForDisplay(change.fields.notes.from),
      to: trimForDisplay(change.fields.notes.to),
    });
  }
  if (change.fields.playbookId) {
    lines.push({
      field: "playbook",
      from: change.fields.playbookId.from ?? "—",
      to: change.fields.playbookId.to ?? "—",
    });
  }
  if (change.fields.checkpoint) {
    lines.push({
      field: "checkpoint",
      from: change.fields.checkpoint.from ? "on" : "off",
      to: change.fields.checkpoint.to ? "on" : "off",
    });
  }
  if (change.fields.owners) {
    lines.push({
      field: "owners",
      from: change.fields.owners.from.join(", ") || "—",
      to: change.fields.owners.to.join(", ") || "—",
    });
  }
  if (change.fields.inputs) {
    const i = change.fields.inputs;
    const parts: string[] = [];
    if (i.added.length) parts.push(`+${i.added.length} added`);
    if (i.removed.length) parts.push(`-${i.removed.length} removed`);
    if (i.changed.length) parts.push(`~${i.changed.length} changed`);
    lines.push({ field: "inputs", from: "current", to: parts.join(", ") || "rewired" });
  }
  return lines;
}

function trimForDisplay(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 60) return trimmed || "—";
  return `${trimmed.slice(0, 57)}…`;
}

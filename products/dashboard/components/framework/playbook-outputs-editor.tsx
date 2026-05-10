"use client";

import { useCallback, useEffect, useId, useMemo, useState, useTransition } from "react";
import { ChevronDown, GripVertical, Plus, Trash2 } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  countTaskOutputsForPlaybookOutputAction,
  createPlaybookOutputAction,
  deletePlaybookOutputAction,
  listPlaybookOutputsAction,
  reorderPlaybookOutputsAction,
  updatePlaybookOutputAction,
} from "@/app/(dashboard)/framework/actions";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useToast } from "@/lib/toast";
import type { PlaybookOutput, PlaybookOutputKind } from "@/lib/workflows/types";
import { cn } from "@/lib/utils";

const KIND_OPTIONS: ReadonlyArray<{ value: PlaybookOutputKind; label: string }> = [
  { value: "file", label: "File" },
  { value: "media", label: "Media" },
  { value: "link", label: "Link" },
  { value: "manual", label: "Manual" },
  { value: "api", label: "API" },
];

const NAME_MAX = 80;

interface DraftRow {
  /** Stable client id; equals the server id once persisted. */
  id: string;
  /** True until the row has been persisted (post-create). New rows live in
   *  client-only state so the user can fill in name/kind before the first
   *  server round-trip. */
  isPending: boolean;
  name: string;
  description: string;
  kind: PlaybookOutputKind;
  apiCheck: string;
  /** Server-side persisted snapshot, used to detect dirty state and surface
   *  unique-name errors only after a real change. */
  saved: PlaybookOutput | null;
}

interface PlaybookOutputsEditorProps {
  playbookId: string;
  initialOutputs?: PlaybookOutput[];
}

function fromServer(output: PlaybookOutput): DraftRow {
  return {
    id: output.id,
    isPending: false,
    name: output.name,
    description: output.description ?? "",
    kind: (output.kind as PlaybookOutputKind | null) ?? "file",
    apiCheck: output.apiCheck ? JSON.stringify(output.apiCheck, null, 2) : "",
    saved: output,
  };
}

function newDraftId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `draft-${crypto.randomUUID()}`;
  }
  return `draft-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function isDirty(row: DraftRow): boolean {
  if (!row.saved) return true;
  const apiCheckSaved = row.saved.apiCheck
    ? JSON.stringify(row.saved.apiCheck, null, 2)
    : "";
  return (
    row.name.trim() !== row.saved.name ||
    row.description.trim() !== (row.saved.description ?? "") ||
    row.kind !== (row.saved.kind ?? "file") ||
    row.apiCheck.trim() !== apiCheckSaved.trim()
  );
}

function parseApiCheck(value: string): { ok: true; value: Record<string, unknown> | null } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false, error: "api_check must be a JSON object" };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, error: "Invalid JSON" };
  }
}

function isUniqueNameConflict(
  rows: DraftRow[],
  candidate: string,
  excludeId: string,
): boolean {
  const needle = candidate.trim().toLowerCase();
  if (!needle) return false;
  return rows.some(
    (row) => row.id !== excludeId && row.name.trim().toLowerCase() === needle,
  );
}

export function PlaybookOutputsEditor({
  playbookId,
  initialOutputs,
}: PlaybookOutputsEditorProps) {
  const headingId = useId();
  const { success: toastSuccess, error: toastError } = useToast();
  const [rows, setRows] = useState<DraftRow[]>(
    () => (initialOutputs ?? []).map(fromServer),
  );
  const [loaded, setLoaded] = useState(initialOutputs !== undefined);
  const [rowErrors, setRowErrors] = useState<Record<string, string | undefined>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  // Confirm-delete state
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    isPending: boolean;
    name: string;
    impactCount: number | null;
  } | null>(null);
  const [confirmInFlight, setConfirmInFlight] = useState(false);

  useEffect(() => {
    if (initialOutputs !== undefined) return;
    let active = true;
    listPlaybookOutputsAction(playbookId)
      .then((outputs) => {
        if (!active) return;
        setRows(outputs.map(fromServer));
        setLoaded(true);
      })
      .catch((err) => {
        if (!active) return;
        toastError(
          err instanceof Error ? err.message : "Could not load outputs",
        );
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [playbookId, initialOutputs, toastError]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortableIds = useMemo(() => rows.map((r) => r.id), [rows]);

  const setRow = useCallback(
    (id: string, patch: Partial<DraftRow>) => {
      setRows((current) =>
        current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
      );
    },
    [],
  );

  const setRowError = useCallback((id: string, message: string | undefined) => {
    setRowErrors((current) => {
      if (current[id] === message) return current;
      const next = { ...current };
      if (message === undefined) delete next[id];
      else next[id] = message;
      return next;
    });
  }, []);

  const markSaving = useCallback((id: string, saving: boolean) => {
    setSavingIds((current) => {
      const next = new Set(current);
      if (saving) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleAdd = useCallback(() => {
    const id = newDraftId();
    setRows((current) => [
      ...current,
      {
        id,
        isPending: true,
        name: "",
        description: "",
        kind: "file",
        apiCheck: "",
        saved: null,
      },
    ]);
  }, []);

  const handleSaveRow = useCallback(
    async (id: string) => {
      const row = rows.find((r) => r.id === id);
      if (!row) return;

      const trimmedName = row.name.trim();
      if (!trimmedName) {
        setRowError(id, "Name is required");
        return;
      }
      if (trimmedName.length > NAME_MAX) {
        setRowError(id, `Name must be ≤ ${NAME_MAX} characters`);
        return;
      }
      if (isUniqueNameConflict(rows, trimmedName, id)) {
        setRowError(id, "Name must be unique within the playbook");
        return;
      }
      const parsedApi = parseApiCheck(row.apiCheck);
      if (!parsedApi.ok) {
        setRowError(id, parsedApi.error);
        return;
      }
      if (row.kind === "api" && !parsedApi.value) {
        // Allowed — api_check is optional even for api kind. Keep behavior
        // permissive and let the founder fill it in later.
      }

      setRowError(id, undefined);
      markSaving(id, true);
      try {
        if (row.isPending) {
          const created = await createPlaybookOutputAction({
            playbookId,
            name: trimmedName,
            description: row.description.trim() || null,
            kind: row.kind,
            apiCheck: parsedApi.value,
          });
          setRows((current) =>
            current.map((r) => (r.id === id ? fromServer(created) : r)),
          );
          toastSuccess("Output added");
        } else {
          const updated = await updatePlaybookOutputAction(row.saved!.id, {
            name: trimmedName,
            description: row.description.trim() || null,
            kind: row.kind,
            apiCheck: parsedApi.value,
          });
          setRows((current) =>
            current.map((r) => (r.id === id ? fromServer(updated) : r)),
          );
          toastSuccess("Output saved");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Save failed";
        if (message.toLowerCase().includes("already exists")) {
          setRowError(id, "Name must be unique within the playbook");
        } else {
          setRowError(id, message);
          toastError(message);
        }
      } finally {
        markSaving(id, false);
      }
    },
    [rows, playbookId, setRowError, markSaving, toastSuccess, toastError],
  );

  const openDeleteConfirm = useCallback(
    async (id: string) => {
      const row = rows.find((r) => r.id === id);
      if (!row) return;
      if (row.isPending) {
        // Pending rows have no server state — drop locally.
        setRows((current) => current.filter((r) => r.id !== id));
        setRowError(id, undefined);
        return;
      }
      setPendingDelete({
        id,
        isPending: false,
        name: row.saved?.name ?? row.name,
        impactCount: null,
      });
      try {
        const count = await countTaskOutputsForPlaybookOutputAction(row.saved!.id);
        setPendingDelete((current) =>
          current && current.id === id ? { ...current, impactCount: count } : current,
        );
      } catch {
        // Non-fatal — show confirm without the count.
        setPendingDelete((current) =>
          current && current.id === id ? { ...current, impactCount: 0 } : current,
        );
      }
    },
    [rows, setRowError],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setConfirmInFlight(true);
    try {
      await deletePlaybookOutputAction(target.id);
      setRows((current) => current.filter((r) => r.id !== target.id));
      setRowError(target.id, undefined);
      toastSuccess("Output deleted");
      setPendingDelete(null);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setConfirmInFlight(false);
    }
  }, [pendingDelete, toastSuccess, toastError, setRowError]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = rows.findIndex((r) => r.id === active.id);
      const newIndex = rows.findIndex((r) => r.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;

      const next = arrayMove(rows, oldIndex, newIndex);
      const previous = rows;
      setRows(next);

      const persistedIds = next
        .filter((r) => !r.isPending && r.saved)
        .map((r) => r.saved!.id);
      if (persistedIds.length === 0) return;

      startTransition(() => {
        reorderPlaybookOutputsAction(playbookId, persistedIds).catch((err) => {
          // Roll back on failure so the UI matches the database.
          setRows(previous);
          toastError(err instanceof Error ? err.message : "Reorder failed");
        });
      });
    },
    [rows, playbookId, toastError],
  );

  return (
    <section
      data-testid="playbook-outputs-editor"
      aria-labelledby={headingId}
      className="mt-10 border-t border-border pt-7"
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2
            id={headingId}
            className="text-[15px] font-semibold tracking-[-0.01em] text-t1"
          >
            Outputs
          </h2>
          <p className="mt-1 text-[12px] text-t2">
            Declared artifacts produced by tasks running this playbook.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          data-testid="playbook-outputs-add"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-bg px-2.5 text-[12px] font-medium text-t1 transition hover:bg-bg-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Plus className="h-3.5 w-3.5" />
          Add output
        </button>
      </header>

      {!loaded ? (
        <p className="text-[12px] text-t3">Loading…</p>
      ) : rows.length === 0 ? (
        <p
          data-testid="playbook-outputs-empty"
          className="rounded-md border border-dashed border-border bg-bg-2 px-4 py-6 text-center text-[12px] text-t2"
        >
          No outputs declared yet.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-2.5">
              {rows.map((row) => (
                <SortableOutputRow
                  key={row.id}
                  row={row}
                  error={rowErrors[row.id]}
                  saving={savingIds.has(row.id)}
                  dirty={isDirty(row)}
                  onChange={(patch) => setRow(row.id, patch)}
                  onSave={() => handleSaveRow(row.id)}
                  onDelete={() => openDeleteConfirm(row.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {pendingDelete ? (
        <ConfirmModal
          title="Delete output?"
          description={
            <div className="space-y-2">
              <p>
                This will permanently delete <span className="font-medium text-t1">{pendingDelete.name}</span>.
              </p>
              {pendingDelete.impactCount === null ? (
                <p className="text-t3">Checking impact…</p>
              ) : pendingDelete.impactCount > 0 ? (
                <p data-testid="playbook-outputs-delete-impact" className="text-t2">
                  {pendingDelete.impactCount} task output {pendingDelete.impactCount === 1 ? "row" : "rows"} will be cascade-deleted.
                </p>
              ) : (
                <p className="text-t3">No tasks have produced this output yet.</p>
              )}
            </div>
          }
          confirmLabel="Delete"
          confirmPending={confirmInFlight}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </section>
  );
}

interface SortableOutputRowProps {
  row: DraftRow;
  error: string | undefined;
  saving: boolean;
  dirty: boolean;
  onChange: (patch: Partial<DraftRow>) => void;
  onSave: () => void;
  onDelete: () => void;
}

function SortableOutputRow({
  row,
  error,
  saving,
  dirty,
  onChange,
  onSave,
  onDelete,
}: SortableOutputRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
  };

  const showApiCheck = row.kind === "api";

  return (
    <li
      ref={setNodeRef}
      data-testid={`playbook-output-row-${row.id}`}
      style={style}
      className={cn(
        "rounded-md border border-border bg-bg p-3",
        isDragging && "shadow-lg",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          ref={setActivatorNodeRef as unknown as React.Ref<HTMLButtonElement>}
          aria-label="Drag to reorder"
          data-testid={`playbook-output-drag-${row.id}`}
          {...(attributes as unknown as Record<string, unknown>)}
          {...(listeners as unknown as Record<string, unknown>)}
          className="mt-1 flex h-7 w-6 cursor-grab items-center justify-center rounded text-t3 hover:bg-bg-3 hover:text-t2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={row.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Output name"
              maxLength={NAME_MAX}
              aria-label="Output name"
              data-testid={`playbook-output-name-${row.id}`}
              className="h-8 min-w-0 flex-1 rounded-md border border-border bg-bg-2 px-2.5 text-[13px] text-t1 placeholder:text-t3 focus:border-accent focus:outline-none"
            />
            <select
              value={row.kind}
              onChange={(e) => onChange({ kind: e.target.value as PlaybookOutputKind })}
              aria-label="Output kind"
              data-testid={`playbook-output-kind-${row.id}`}
              className="h-8 rounded-md border border-border bg-bg-2 px-2 text-[12px] text-t1 focus:border-accent focus:outline-none"
            >
              {KIND_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <textarea
            value={row.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Description (optional)"
            rows={2}
            aria-label="Output description"
            data-testid={`playbook-output-description-${row.id}`}
            className="block w-full resize-y rounded-md border border-border bg-bg-2 px-2.5 py-1.5 text-[12px] text-t1 placeholder:text-t3 focus:border-accent focus:outline-none"
          />

          {showApiCheck ? (
            <details className="group rounded-md border border-border bg-bg-2">
              <summary className="flex cursor-pointer list-none items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-t2 [&::-webkit-details-marker]:hidden">
                <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
                api_check
              </summary>
              <textarea
                value={row.apiCheck}
                onChange={(e) => onChange({ apiCheck: e.target.value })}
                placeholder='{"url": "https://…"}'
                rows={4}
                aria-label="api_check JSON"
                data-testid={`playbook-output-api-check-${row.id}`}
                className="block w-full resize-y rounded-b-md border-0 border-t border-border bg-bg px-2.5 py-2 font-mono text-[11px] text-t1 placeholder:text-t3 focus:outline-none"
                spellCheck={false}
              />
            </details>
          ) : null}

          {error ? (
            <p
              data-testid={`playbook-output-error-${row.id}`}
              className="text-[12px] text-rose-400"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onDelete}
              data-testid={`playbook-output-delete-${row.id}`}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-t2 transition hover:bg-bg-3 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!dirty || saving}
              data-testid={`playbook-output-save-${row.id}`}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-md border border-border px-2.5 text-[11px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                dirty && !saving
                  ? "bg-accent text-bg hover:opacity-90"
                  : "bg-bg-2 text-t3",
              )}
            >
              {saving ? "Saving…" : row.isPending ? "Add" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, GripVertical, Plus, Save, Trash2, Undo2, X } from "lucide-react";
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
import { InlineEditableText } from "@/components/ui/inline-editable-text";
import { ItemAvatar } from "@/components/framework/item-avatar";
import { useToast } from "@/lib/toast";
import { OUTPUT_KIND_AVATAR, outputKindAvatar } from "@/lib/workflows/output-kind";
import type { PlaybookOutput, PlaybookOutputKind } from "@/lib/workflows/types";
import { cn } from "@/lib/utils";

/** Picker options. Colors + emoji come from the shared palette
 *  (`OUTPUT_KIND_AVATAR`) so the dock matches the workflow drawer's
 *  avatar treatment one-to-one. Labels are dock-local. */
const KIND_PICKER_OPTIONS: ReadonlyArray<{
  value: PlaybookOutputKind;
  label: string;
}> = [
  { value: "file", label: "File" },
  { value: "media", label: "Media" },
  { value: "link", label: "Link" },
  { value: "api", label: "API" },
  { value: "manual", label: "Manual" },
];

function kindLabel(kind: PlaybookOutputKind): string {
  return KIND_PICKER_OPTIONS.find((opt) => opt.value === kind)?.label ?? "Manual";
}

const NAME_MAX = 80;

interface DraftRow {
  id: string;
  isPending: boolean;
  name: string;
  description: string;
  kind: PlaybookOutputKind;
  apiCheck: string;
  saved: PlaybookOutput | null;
}

export interface PlaybookOutputsDockProps {
  playbookId: string;
  initialOutputs?: PlaybookOutput[];
  /** When true on `<lg` screens, the dock slides in as an overlay drawer.
   *  At `lg+` the dock is always rendered as a persistent right column and
   *  this prop is ignored. */
  mobileOpen?: boolean;
  /** Backdrop click / Escape handler for the mobile overlay. */
  onMobileClose?: () => void;
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

function parseApiCheck(
  value: string,
): { ok: true; value: Record<string, unknown> | null } | { ok: false; error: string } {
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

export function PlaybookOutputsDock({
  playbookId,
  initialOutputs,
  mobileOpen = false,
  onMobileClose,
}: PlaybookOutputsDockProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [rows, setRows] = useState<DraftRow[]>(
    () => (initialOutputs ?? []).map(fromServer),
  );
  const [loaded, setLoaded] = useState(initialOutputs !== undefined);
  const [rowErrors, setRowErrors] = useState<Record<string, string | undefined>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  const [, startTransition] = useTransition();

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
        toastError(err instanceof Error ? err.message : "Could not load outputs");
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [playbookId, initialOutputs, toastError]);

  // Close mobile overlay on Escape.
  useEffect(() => {
    if (!mobileOpen || !onMobileClose) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onMobileClose?.();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [mobileOpen, onMobileClose]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortableIds = useMemo(() => rows.map((r) => r.id), [rows]);

  const setRow = useCallback((id: string, patch: Partial<DraftRow>) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }, []);

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
    // Auto-expand when adding so the new row is visible.
    setCollapsed(false);
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
          setRows(previous);
          toastError(err instanceof Error ? err.message : "Reorder failed");
        });
      });
    },
    [rows, playbookId, toastError],
  );

  const total = rows.length;

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-[var(--overlay)] backdrop-blur-[2px] transition-opacity duration-200 lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden
        onClick={onMobileClose}
      />
      <aside
        data-testid="playbook-outputs-editor"
        aria-label="Playbook outputs"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[92vw] max-w-[460px] flex-col border-l border-border bg-bg shadow-[var(--shadow-canvas)] transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          mobileOpen ? "translate-x-0" : "translate-x-full",
          "lg:static lg:z-auto lg:w-[420px] lg:shrink-0 lg:translate-x-0 lg:shadow-none lg:transition-none",
        )}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-bg px-4 py-3">
          <div className="flex h-8 items-center">
            <p className="text-[13px] font-semibold tracking-tight text-t1">
              Metadata
            </p>
          </div>
          {onMobileClose ? (
            <button
              type="button"
              onClick={onMobileClose}
              aria-label="Close outputs panel"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-t3 transition hover:bg-bg-2 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:hidden"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <section
            className={cn("pb-drawer-sec", "pb-drawer-outputs")}
            data-collapsed={collapsed}
          >
            <div className="pb-drawer-sec__head">
              <button
                type="button"
                className="pb-drawer-sec__toggle"
                onClick={() => setCollapsed((prev) => !prev)}
                aria-expanded={!collapsed}
              >
                <ChevronRight
                  size={12}
                  className={cn(
                    "pb-drawer-sec__chev",
                    !collapsed && "pb-drawer-sec__chev--open",
                  )}
                  aria-hidden
                />
                <span className="pb-drawer-sec__lbl">
                  Outputs <span className="pb-drawer-sec__count">{total}</span>
                </span>
              </button>
            </div>

            {!collapsed ? (
              !loaded ? (
                <ul
                  aria-label="Loading outputs"
                  data-testid="playbook-outputs-skeleton"
                  className="mt-2 flex flex-col gap-2"
                >
                  {Array.from({ length: 3 }, (_, i) => (
                    <li
                      key={i}
                      className="animate-pulse rounded-lg border border-border bg-bg-3 p-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 shrink-0 rounded-full bg-bg-4" />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="h-2.5 w-2/3 rounded bg-bg-4" />
                          <div className="h-2 w-1/2 rounded bg-bg-4" />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <>
                  {rows.length > 0 ? (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={sortableIds}
                        strategy={verticalListSortingStrategy}
                      >
                        <ul className="mt-2 flex flex-col gap-2">
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
                              onDiscard={() => {
                                if (row.saved) {
                                  setRows((current) =>
                                    current.map((r) =>
                                      r.id === row.id ? fromServer(row.saved!) : r,
                                    ),
                                  );
                                }
                                setRowError(row.id, undefined);
                              }}
                            />
                          ))}
                        </ul>
                      </SortableContext>
                    </DndContext>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleAdd}
                    data-testid="playbook-outputs-add"
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-transparent px-3 py-2.5 text-[12px] font-medium text-t3 transition hover:border-border-hi hover:bg-bg-2 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    Add output
                  </button>
                </>
              )
            ) : null}
          </section>
        </div>
      </aside>

      {pendingDelete ? (
        <ConfirmModal
          title="Delete output?"
          description={
            <div className="space-y-2">
              <p>
                This will permanently delete{" "}
                <span className="font-medium text-t1">{pendingDelete.name}</span>{" "}
                from this playbook&rsquo;s definition.
              </p>
              <p className="text-t3">
                Tasks already created from this playbook keep their own copy of
                this output and are not affected.
              </p>
              {pendingDelete.impactCount === null ? (
                <p className="text-t3">Checking impact…</p>
              ) : pendingDelete.impactCount > 0 ? (
                <p data-testid="playbook-outputs-delete-impact" className="text-t2">
                  {pendingDelete.impactCount} produced task output{" "}
                  {pendingDelete.impactCount === 1 ? "row" : "rows"} will keep its
                  history.
                </p>
              ) : (
                <p className="text-t3">Not referenced by any task yet.</p>
              )}
            </div>
          }
          confirmLabel="Delete"
          confirmPending={confirmInFlight}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </>
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
  onDiscard: () => void;
}

function SortableOutputRow({
  row,
  error,
  saving,
  dirty,
  onChange,
  onSave,
  onDelete,
  onDiscard,
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
  const canDiscard = !row.isPending && dirty;
  const showActions = dirty || row.isPending;

  return (
    <li
      ref={setNodeRef}
      data-testid={`playbook-output-row-${row.id}`}
      style={style}
      className={cn(
        "group/output rounded-lg border border-border bg-bg-3 px-2.5 py-2 transition-colors hover:border-border-hi",
        dirty && "border-border-hi bg-bg-4",
        isDragging && "shadow-lg",
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          ref={setActivatorNodeRef as unknown as React.Ref<HTMLButtonElement>}
          aria-label="Drag to reorder"
          data-testid={`playbook-output-drag-${row.id}`}
          {...(attributes as unknown as Record<string, unknown>)}
          {...(listeners as unknown as Record<string, unknown>)}
          className="flex h-6 w-4 shrink-0 cursor-grab items-center justify-center rounded text-t3/70 transition hover:text-t2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        <KindAvatarPicker
          rowId={row.id}
          value={row.kind}
          onChange={(next) => onChange({ kind: next })}
        />

        <div className="min-w-0 flex-1">
          <InlineEditableText
            value={row.name}
            onChange={(next) => onChange({ name: next })}
            ariaLabel="Output name"
            placeholder="Output name"
            maxLength={NAME_MAX}
            className="block w-full text-[13px] font-semibold tracking-tight text-t1"
          />
          <InlineEditableText
            value={row.description}
            onChange={(next) => onChange({ description: next })}
            ariaLabel="Output description"
            placeholder="Add a description"
            className="mt-0.5 block w-full text-[11.5px] leading-5 text-t2"
          />

          {showApiCheck ? (
            <details
              className="group mt-2 rounded-md border border-border bg-bg-3"
              data-testid={`playbook-output-api-check-wrap-${row.id}`}
            >
              <summary className="flex cursor-pointer list-none items-center gap-1 px-2 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-t2 [&::-webkit-details-marker]:hidden">
                <ChevronDown className="h-3 w-3 transition group-open:rotate-180" />
                api_check
              </summary>
              <textarea
                value={row.apiCheck}
                onChange={(e) => onChange({ apiCheck: e.target.value })}
                placeholder='{"url": "https://…"}'
                rows={4}
                aria-label="api_check JSON"
                data-testid={`playbook-output-api-check-${row.id}`}
                className="block w-full resize-y rounded-b-md border-0 border-t border-border bg-bg px-2 py-1.5 font-mono text-[10.5px] text-t1 placeholder:text-t3 focus:outline-none"
                spellCheck={false}
              />
            </details>
          ) : null}

          {error ? (
            <p
              data-testid={`playbook-output-error-${row.id}`}
              className="mt-1 text-[11px] text-rose-400"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>

        <div className="mx-entity-actions mx-entity-actions-group shrink-0 bg-bg-4! border-border-hi!">
          {showActions && canDiscard ? (
            <button
              type="button"
              onClick={onDiscard}
              disabled={saving}
              aria-label="Discard changes"
              title="Discard changes"
              data-testid={`playbook-output-cancel-${row.id}`}
              className="mx-entity-action"
            >
              <Undo2 size={11} strokeWidth={2.1} aria-hidden />
            </button>
          ) : null}
          {showActions ? (
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              aria-label="Save"
              title="Save"
              data-testid={`playbook-output-save-${row.id}`}
              className="mx-entity-action mx-entity-action-success"
            >
              <Save size={11} strokeWidth={2.1} aria-hidden />
              <span className="sr-only">{saving ? "Saving…" : "Save"}</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete output"
            title="Delete output"
            data-testid={`playbook-output-delete-${row.id}`}
            className="mx-entity-action mx-entity-action-danger"
          >
            <Trash2 size={11} strokeWidth={2.1} aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}

interface KindAvatarPickerProps {
  rowId: string;
  value: PlaybookOutputKind;
  onChange: (next: PlaybookOutputKind) => void;
}

function KindAvatarPicker({ rowId, value, onChange }: KindAvatarPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const currentAvatar = outputKindAvatar(value);
  const currentLabel = kindLabel(value);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Output kind: ${currentLabel}. Change kind.`}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid={`playbook-output-kind-${rowId}`}
        data-kind={value}
        className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <ItemAvatar
          emoji={currentAvatar.emoji}
          color={currentAvatar.color}
          label={currentLabel}
          size="sm"
        />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label="Output kind"
          className="absolute left-0 top-full z-30 mt-2 w-40 overflow-hidden rounded-lg border border-border-hi bg-bg-2 shadow-[var(--shadow-canvas)]"
        >
          {KIND_PICKER_OPTIONS.map((opt) => {
            const selected = opt.value === value;
            const avatar = OUTPUT_KIND_AVATAR[opt.value];
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setOpen(false);
                  if (!selected) onChange(opt.value);
                }}
                data-testid={`playbook-output-kind-option-${rowId}-${opt.value}`}
                className={cn(
                  "flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-[12px] transition",
                  selected ? "bg-primary-bg text-accent" : "text-t2 hover:bg-bg-3 hover:text-t1",
                )}
              >
                <ItemAvatar
                  emoji={avatar.emoji}
                  color={avatar.color}
                  label={opt.label}
                  size="sm"
                />
                <span className="font-medium">{opt.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  GripVertical,
  Plus,
  Search,
  SearchX,
  Trash2,
  X,
} from "lucide-react";
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

import { cn } from "@/lib/utils";
import { ItemAvatar } from "@/components/framework/item-avatar";
import { OwnerPicker } from "@/components/framework/owner-picker";
import { resolveItemColor } from "@/lib/workflows/skill-colors";
import {
  PlaybookOutputPicker,
  type PlaybookOutputPickerValue,
} from "@/components/workflows/playbook-output-picker";
import { outputKindAvatar, outputKindLabel } from "@/lib/workflows/output-kind";
import type {
  FrameworkItem,
  PlaybookOutput,
  TemplateOutputGroup,
  WorkflowInput,
} from "@/lib/workflows/types";

interface AddPlaybookDrawerProps {
  mode?: "create" | "edit";
  /** Skill row this task belongs to (locked context, not a picker). */
  skillId: string;
  skillLabel: string;
  /** Resolved skill color, used to paint the header stripe so the drawer
   *  matches the source card's identity bar. */
  skillColor?: string;
  stageId: string;
  stageName: string;
  /** All playbooks loaded by the parent page; drawer filters by allowedSkillIds. */
  playbooks: FrameworkItem[];
  initial?: {
    playbookId?: string | null;
    notes?: string;
    owners?: readonly string[];
    inputs?: readonly WorkflowInput[];
    /** Per-task snapshot of the playbook's outputs. In edit mode this is
     *  the source of truth — the drawer never re-fetches the definition.
     *  In create mode this is unused; the drawer snapshots from the
     *  selected playbook on demand. */
    outputs?: readonly PlaybookOutput[];
  };
  /** Other tasks in the same template — populates the upstream-task select. */
  upstreamTaskOptions?: { id: string; label: string; playbookId?: string | null }[];
  /** Outputs grouped per attached playbook — populates the wiring picker. */
  outputGroups?: TemplateOutputGroup[];
  /** Called by the picker when it wants the parent to refetch (e.g. a
   *  stale-ref save error has fired and the user is reopening the drawer). */
  onRefetchOutputs?: () => void | Promise<void>;
  /** Lazy-fetch the playbook definition's outputs to seed the snapshot when
   *  a new playbook is selected in create mode. Both call sites pass a thin
   *  wrapper around `listPlaybookOutputsAction`; if omitted, the Outputs
   *  section just renders empty until the user saves and reopens. */
  loadPlaybookOutputs?: (playbookId: string) => Promise<PlaybookOutput[]>;
  onClose: () => void;
  onSubmit: (input: {
    playbookId: string;
    notes: string;
    owners: string[];
    inputs: WorkflowInput[];
    outputs: PlaybookOutput[];
  }) => void;
}

function createInputId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `inp-${crypto.randomUUID()}`;
  }
  return `inp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AddPlaybookDrawer({
  mode = "create",
  skillId,
  skillLabel,
  skillColor,
  stageName,
  playbooks,
  initial,
  upstreamTaskOptions = [],
  outputGroups = [],
  onRefetchOutputs,
  loadPlaybookOutputs,
  onClose,
  onSubmit,
}: AddPlaybookDrawerProps) {
  const [selectedId, setSelectedId] = useState<string>(initial?.playbookId ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [owners, setOwners] = useState<string[]>(
    initial?.owners ? [...initial.owners] : [],
  );
  const [inputs, setInputs] = useState<WorkflowInput[]>(() =>
    initial?.inputs ? initial.inputs.map((i) => ({ ...i })) : [],
  );
  const [outputs, setOutputs] = useState<PlaybookOutput[]>(() =>
    initial?.outputs ? initial.outputs.map((o) => ({ ...o })) : [],
  );
  const [outputsLoading, setOutputsLoading] = useState(false);
  const [query, setQuery] = useState("");
  /** User override for the Inputs collapse header. Defaults to `null`
   *  (expanded). Switching to "collapsed" lets the user hide the editor. */
  const [inputsOverride, setInputsOverride] = useState<
    "expanded" | "collapsed" | null
  >(null);
  /** User override for the Outputs collapse header. Mirrors Inputs:
   *  defaults to expanded so the remove/reorder controls are reachable. */
  const [outputsOverride, setOutputsOverride] = useState<
    "expanded" | "collapsed" | null
  >(null);
  /** User override for the Notes collapse header. Auto-seeds expanded
   *  when the existing notes have content (matches the previous `<details
   *  open>` behavior); otherwise collapsed. */
  const [notesOverride, setNotesOverride] = useState<
    "expanded" | "collapsed" | null
  >(null);
  // Two-step open: mount offscreen, then flip the class one frame later so
  // the slide-in animation actually plays.
  const [openClass, setOpenClass] = useState(false);
  const closingRef = useRef(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpenClass(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Drawer mount is the canonical opportunity to refresh the upstream
  // output catalog. Previously this fired when the user clicked "+ Add
  // input"; with the inline picker that gate is gone, so we refetch once
  // on mount so the dropdown always shows the current outputs.
  useEffect(() => {
    void onRefetchOutputs?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Snapshot the selected playbook's outputs when the user picks a new
  // playbook in create mode. Always re-fetches on selection change so the
  // list reflects the *current* playbook (a previous pick may have left
  // stale rows in state, especially after the user removed some). Edit
  // mode never re-fetches: the snapshot is already in `initial.outputs`
  // and the user's removals/reorders would otherwise be wiped on render.
  useEffect(() => {
    if (mode !== "create") return;
    if (!selectedId) {
      setOutputs([]);
      setOutputsLoading(false);
      return;
    }
    if (!loadPlaybookOutputs) {
      setOutputs([]);
      return;
    }
    let cancelled = false;
    // Clear immediately so the user sees the list reset while the new
    // playbook's outputs are in flight — otherwise the previous pick's
    // rows linger and the swap reads as broken.
    setOutputs([]);
    setOutputsLoading(true);
    loadPlaybookOutputs(selectedId)
      .then((definition) => {
        if (cancelled) return;
        setOutputs(definition.map((o) => ({ ...o })));
      })
      .catch(() => {
        // Soft-fail: leave the snapshot empty. The user can still attach
        // the playbook; the outputs list just stays empty until they edit
        // it later.
        if (cancelled) return;
        setOutputs([]);
      })
      .finally(() => {
        if (cancelled) return;
        setOutputsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // mode + loadPlaybookOutputs are stable for the lifetime of the drawer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const outputSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortableOutputIds = useMemo(() => outputs.map((o) => o.id), [outputs]);

  const handleOutputDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOutputs((current) => {
      const oldIndex = current.findIndex((o) => o.id === active.id);
      const newIndex = current.findIndex((o) => o.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      return arrayMove(current, oldIndex, newIndex).map((o, position) => ({
        ...o,
        position,
      }));
    });
  };

  const handleRemoveOutput = (outputId: string) => {
    setOutputs((current) =>
      current
        .filter((o) => o.id !== outputId)
        .map((o, position) => ({ ...o, position })),
    );
  };

  // Animated close: drop the open class so the slide-out plays, wait for
  // the 260ms transition, then call the parent's unmount (`onClose`). Idem-
  // potent — chained calls (overlay click + Escape, etc.) are no-ops once
  // the animation has started.
  const requestClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setOpenClass(false);
    window.setTimeout(() => {
      onClose();
    }, 280);
  };

  const didScrollToSelectedRef = useRef(false);
  const setActivePlaybookButtonRef = (el: HTMLButtonElement | null) => {
    if (el && !didScrollToSelectedRef.current) {
      el.scrollIntoView({ block: "nearest" });
      didScrollToSelectedRef.current = true;
    }
  };

  const allowed = useMemo(
    () =>
      playbooks.filter(
        (pb) => pb.type === "playbook" && (pb.allowedSkillIds ?? []).includes(skillId),
      ),
    [playbooks, skillId],
  );

  const selectedPlaybook = useMemo(
    () => playbooks.find((pb) => pb.id === selectedId) ?? null,
    [playbooks, selectedId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allowed;
    return allowed.filter((pb) =>
      [pb.name, pb.description].some((field) => field.toLowerCase().includes(q)),
    );
  }, [allowed, query]);

  // Hide already-wired outputs from the draft picker so the same playbook
  // output can't be added twice. Groups that lose every output are dropped
  // entirely so the picker doesn't show empty section headers.
  const availableForDraft = useMemo(() => {
    const taken = new Set(
      inputs
        .map((i) => i.upstreamOutputId)
        .filter((id): id is string => Boolean(id)),
    );
    if (taken.size === 0) return outputGroups;
    return outputGroups
      .map((group) => ({
        ...group,
        outputs: group.outputs.filter((o) => !taken.has(o.id)),
      }))
      .filter((group) => group.outputs.length > 0);
  }, [outputGroups, inputs]);

  const canSubmit = Boolean(selectedId);
  // Editor context: default expanded so the "+ Add" affordance is always one
  // click away. User can collapse via the chevron; their choice sticks.
  // (The playbook drawer auto-collapses when empty because it's a read-only
  // surface — auto-folding the editor would hide the only way to wire inputs.)
  const inputsCollapsed = inputsOverride === "collapsed";
  // Outputs default expanded so the remove/reorder controls are reachable;
  // user override sticks. Auto-collapses to nothing when there's no playbook
  // selected yet (the section isn't rendered at all in that case).
  const outputsCollapsed = outputsOverride === "collapsed";
  // Notes auto-collapse when empty (mirrors the previous `<details open>`
  // behavior that opened only when seeded with text). User override sticks.
  const notesCollapsed =
    notesOverride === "collapsed" ||
    (notesOverride === null && notes.trim().length === 0);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // requestClose is stable for the lifetime of the component (relies on
    // refs + setState) so we intentionally don't list it as a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[65] bg-(--overlay) backdrop-blur-[3px] transition-opacity duration-200",
          openClass ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden
        onClick={requestClose}
        data-testid="add-playbook-drawer-overlay"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-playbook-drawer-title"
        className={cn(
          "fixed inset-y-0 right-0 z-[70] flex w-full max-w-[520px] flex-col border-l border-border-hi bg-bg-2 shadow-[var(--shadow-canvas)] transition-transform duration-[260ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none",
          openClass ? "translate-x-0" : "translate-x-full",
        )}
        data-testid="add-playbook-drawer"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit) return;
            // Drop incomplete (unwired) input rows on submit — they would
            // otherwise persist as a name-less linked input pointing nowhere.
            const wiredInputs = inputs.filter((i) => Boolean(i.upstreamOutputId));
            // Re-stamp positions from array order so the persisted snapshot
            // reflects any reorder edits the user made.
            const positionedOutputs = outputs.map((o, position) => ({
              ...o,
              position,
            }));
            onSubmit({
              playbookId: selectedId,
              notes,
              owners,
              inputs: wiredInputs,
              outputs: positionedOutputs,
            });
          }}
          className="flex h-full min-h-0 flex-col"
        >
          <div
            className="pb-drawer-head"
            style={
              skillColor
                ? ({ "--role-color": skillColor } as React.CSSProperties)
                : undefined
            }
            data-bar-variant="none"
          >
          <header
            className="pb-drawer-context"
          >
            <div className="pb-drawer-context__inner">
              <div className="pb-drawer-context__crumbs">
                <span>{stageName}</span>
                <span className="pb-drawer-context__crumb-sep" aria-hidden>
                  ·
                </span>
                <span>{skillLabel}</span>
              </div>
              <button
                type="button"
                onClick={requestClose}
                aria-label="Close"
                className="pb-drawer-context__close"
              >
                <X size={14} aria-hidden />
              </button>
              {mode === "edit" && selectedPlaybook ? (
                <div className="pb-drawer-context__title-block">
                  <h2
                    id="add-playbook-drawer-title"
                    className="pb-drawer-context__title"
                  >
                    {selectedPlaybook.name}
                  </h2>
                  {selectedPlaybook.description ? (
                    <p className="pb-drawer-context__desc">
                      {selectedPlaybook.description}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="pb-drawer-context__title-block flex items-end justify-between gap-3">
                  <h2
                    id="add-playbook-drawer-title"
                    className="pb-drawer-context__title"
                  >
                    Add playbook
                  </h2>
                  <Link
                    href="/framework/playbooks"
                    className="text-[11.5px] text-t3 hover:text-accent hover:underline"
                  >
                    Manage playbooks →
                  </Link>
                </div>
              )}
            </div>
          </header>

          {allowed.length > 0 ? (
            <div className="flex shrink-0 items-center gap-2 border-b border-border bg-bg-3 px-6 py-3">
              <OwnerPicker
                values={owners}
                onChange={setOwners}
                variant="stack"
                required={false}
                stackAvatarSize="xs"
                stackEmptyLabel
                testIdSuffix="add-playbook-drawer"
              />
            </div>
          ) : null}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
            {allowed.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border-hi bg-bg-3 px-4 py-6 text-center text-[12.5px] text-t3">
                <div className="mb-2 font-medium text-t2">
                  No playbooks allowed for &ldquo;{skillLabel}&rdquo; yet
                </div>
                <Link
                  href="/framework/playbooks"
                  className="text-[12px] text-accent hover:underline"
                >
                  Open a playbook and add this skill under &ldquo;Allowed skills&rdquo; →
                </Link>
              </div>
            ) : (
              <>
                {mode === "edit" ? null : (
                <div className="mb-4 rounded-lg border border-border bg-bg-3">
                  <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                    <Search className="h-3.5 w-3.5 text-t3" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search playbooks"
                      autoFocus
                      className="w-full bg-transparent text-[13px] text-t1 placeholder:text-t3 focus:outline-none"
                    />
                  </div>
                  <div className="h-56 overflow-y-auto p-1.5">
                    {filtered.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-md bg-bg-2/40 px-4 text-center">
                        <SearchX aria-hidden className="h-5 w-5 text-t3" />
                        <div className="text-[12.5px] font-medium text-t2">
                          No playbooks match &ldquo;{query.trim()}&rdquo;
                        </div>
                        <div className="text-[10.5px] leading-[1.5] text-t3">
                          Try a different keyword, or allow this skill on a
                          playbook in the Playbooks page.
                        </div>
                      </div>
                    ) : (
                      filtered.map((pb) => {
                        const active = pb.id === selectedId;
                        return (
                          <button
                            key={pb.id}
                            ref={active ? setActivePlaybookButtonRef : undefined}
                            type="button"
                            onClick={() => setSelectedId(pb.id)}
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition",
                              active
                                ? "bg-primary-bg text-accent"
                                : "text-t2 hover:bg-bg-4 hover:text-t1",
                            )}
                          >
                            <ItemAvatar
                              emoji={pb.icon}
                              color={resolveItemColor(pb)}
                              label={pb.name}
                              size="sm"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] font-semibold">
                                {pb.name}
                              </span>
                              {pb.description ? (
                                <span className="mt-0.5 block truncate text-[10.5px] text-t3">
                                  {pb.description}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
                )}

                <section
                  className={cn("pb-drawer-sec", "pb-drawer-inputs", "mb-5")}
                  data-testid="add-playbook-drawer-inputs-section"
                  data-collapsed={inputsCollapsed}
                >
                  <div className="pb-drawer-sec__head">
                    <button
                      type="button"
                      className="pb-drawer-sec__toggle"
                      onClick={() =>
                        setInputsOverride(
                          inputsCollapsed ? "expanded" : "collapsed",
                        )
                      }
                      aria-expanded={!inputsCollapsed}
                      data-testid="add-playbook-drawer-inputs-toggle"
                    >
                      <ChevronRight
                        size={12}
                        className={cn(
                          "pb-drawer-sec__chev",
                          !inputsCollapsed && "pb-drawer-sec__chev--open",
                        )}
                        aria-hidden
                      />
                      <span className="pb-drawer-sec__lbl">
                        Inputs{" "}
                        <span className="pb-drawer-sec__count">
                          {inputs.length}
                        </span>
                      </span>
                    </button>
                  </div>
                  {!inputsCollapsed ? (
                  <ul className="space-y-2">
                      {inputs.map((input, index) => {
                        const wiredGroup = input.upstreamOutputId
                          ? outputGroups.find((g) =>
                              g.outputs.some((o) => o.id === input.upstreamOutputId),
                            )
                          : null;
                        const wiredOutput = wiredGroup?.outputs.find(
                          (o) => o.id === input.upstreamOutputId,
                        );
                        const wiredPlaybook = wiredGroup
                          ? playbooks.find((pb) => pb.id === wiredGroup.playbookId)
                          : null;
                        return (
                          <li
                            key={input.id}
                            className="flex items-center gap-2.5 rounded-lg border border-border bg-bg-3 px-2.5 py-2"
                            data-testid={`input-row-${index}`}
                          >
                            {wiredPlaybook ? (
                              <ItemAvatar
                                emoji={wiredPlaybook.icon}
                                color={resolveItemColor(wiredPlaybook)}
                                label={wiredPlaybook.name}
                                size="sm"
                              />
                            ) : null}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] font-semibold text-t1">
                                {wiredGroup?.playbookName ?? "Unknown playbook"}
                              </span>
                              <span className="mt-0.5 block truncate text-[11px] text-t3">
                                {wiredOutput?.name ?? "Unknown output"}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setInputs((current) =>
                                  current.filter((_, j) => j !== index),
                                )
                              }
                              aria-label="Remove input"
                              data-testid={`input-row-${index}-delete`}
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-t3 transition hover:bg-bg-4 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        );
                      })}
                      <li>
                        <PlaybookOutputPicker
                          value={null}
                          available={availableForDraft}
                          playbooks={playbooks}
                          fullWidthTrigger
                          triggerLabel="Add input"
                          triggerLeadingIcon={
                            <Plus
                              className="h-3.5 w-3.5 transition"
                              aria-hidden
                            />
                          }
                          hideTriggerChevron
                          testId="add-input-row"
                          onChange={(next: PlaybookOutputPickerValue | null) => {
                            if (next === null) return;
                            const group = outputGroups.find(
                              (g) => g.playbookId === next.playbookId,
                            );
                            const output = group?.outputs.find(
                              (o) => o.id === next.outputId,
                            );
                            const derivedName = group && output
                              ? `${group.playbookName} / ${output.name}`
                              : "";
                            const derivedRef = upstreamTaskOptions.find(
                              (opt) => opt.playbookId === next.playbookId,
                            )?.id;
                            setInputs((current) => [
                              ...current,
                              {
                                id: createInputId(),
                                name: derivedName,
                                linkMode: "linked",
                                upstreamTaskRef: derivedRef,
                                upstreamOutputId: next.outputId,
                              },
                            ]);
                          }}
                        />
                      </li>
                    </ul>
                  ) : null}
                </section>

                <OutputsEditorSection
                  outputs={outputs}
                  sortableIds={sortableOutputIds}
                  sensors={outputSensors}
                  collapsed={outputsCollapsed}
                  loading={outputsLoading}
                  hasSelection={Boolean(selectedId)}
                  onToggleCollapsed={() =>
                    setOutputsOverride(
                      outputsCollapsed ? "expanded" : "collapsed",
                    )
                  }
                  onDragEnd={handleOutputDragEnd}
                  onRemove={handleRemoveOutput}
                />

                <section
                  className="pb-drawer-sec"
                  data-testid="add-playbook-drawer-notes-section"
                  data-collapsed={notesCollapsed}
                >
                  <div className="pb-drawer-sec__head">
                    <button
                      type="button"
                      className="pb-drawer-sec__toggle"
                      onClick={() =>
                        setNotesOverride(
                          notesCollapsed ? "expanded" : "collapsed",
                        )
                      }
                      aria-expanded={!notesCollapsed}
                      data-testid="add-playbook-drawer-notes-toggle"
                    >
                      <ChevronRight
                        size={12}
                        className={cn(
                          "pb-drawer-sec__chev",
                          !notesCollapsed && "pb-drawer-sec__chev--open",
                        )}
                        aria-hidden
                      />
                      <span className="pb-drawer-sec__lbl">
                        Notes{" "}
                        <span className="pb-drawer-sec__count">(optional)</span>
                      </span>
                    </button>
                  </div>
                  {!notesCollapsed ? (
                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      rows={2}
                      placeholder="Per-instance context for this playbook"
                      className="block w-full resize-none rounded-lg border border-border bg-bg-3 px-3 py-2.5 text-[13px] leading-6 text-t1 placeholder:text-t3 focus:outline-none focus:border-border-hi"
                    />
                  ) : null}
                </section>
              </>
            )}
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-border bg-bg-2 px-6 py-4">
              <button
                type="button"
                onClick={requestClose}
                className="rounded-lg border border-border bg-bg-3 px-4 py-2 text-[13px] font-medium text-t2 transition hover:bg-bg-4 hover:text-t1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-lg bg-primary px-5 py-2 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mode === "edit" ? "Save playbook →" : "Add playbook →"}
              </button>
          </footer>
        </form>
      </aside>
    </>
  );
}

interface OutputsEditorSectionProps {
  outputs: PlaybookOutput[];
  sortableIds: string[];
  sensors: ReturnType<typeof useSensors>;
  collapsed: boolean;
  loading: boolean;
  /** True once the user has picked a playbook. Drives the empty-state copy:
   *  before selection, the section shows a "pick a playbook to see outputs"
   *  hint instead of "no outputs declared", which would falsely imply the
   *  selected playbook had none. */
  hasSelection: boolean;
  onToggleCollapsed: () => void;
  onDragEnd: (event: DragEndEvent) => void;
  onRemove: (outputId: string) => void;
}

function OutputsEditorSection({
  outputs,
  sortableIds,
  sensors,
  collapsed,
  loading,
  hasSelection,
  onToggleCollapsed,
  onDragEnd,
  onRemove,
}: OutputsEditorSectionProps) {
  const emptyMessage = !hasSelection
    ? "Pick a playbook to load its outputs."
    : loading
      ? "Loading outputs…"
      : "This playbook has no declared outputs.";
  return (
    <section
      className={cn("pb-drawer-sec", "pb-drawer-outputs", "mb-5")}
      data-testid="add-playbook-drawer-outputs-section"
      data-collapsed={collapsed}
    >
      <div className="pb-drawer-sec__head">
        <button
          type="button"
          className="pb-drawer-sec__toggle"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          data-testid="add-playbook-drawer-outputs-toggle"
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
            Outputs{" "}
            <span className="pb-drawer-sec__count">{outputs.length}</span>
          </span>
        </button>
      </div>
      {!collapsed ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={sortableIds}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-2">
              {outputs.length === 0 ? (
                <li
                  className="rounded-lg border border-dashed border-border bg-bg-3 px-3 py-4 text-center text-[12px] text-t3"
                  data-testid="add-playbook-drawer-outputs-empty"
                >
                  {emptyMessage}
                </li>
              ) : (
                outputs.map((output, index) => (
                  <SortableOutputRow
                    key={output.id}
                    output={output}
                    index={index}
                    onRemove={onRemove}
                  />
                ))
              )}
            </ul>
          </SortableContext>
        </DndContext>
      ) : null}
    </section>
  );
}

interface SortableOutputRowProps {
  output: PlaybookOutput;
  index: number;
  onRemove: (outputId: string) => void;
}

function SortableOutputRow({ output, index, onRemove }: SortableOutputRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: output.id });

  const { emoji, color } = outputKindAvatar(output.kind);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      data-testid={`output-row-${index}`}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border bg-bg-3 px-2 py-2",
        isDragging && "shadow-lg",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef as unknown as React.Ref<HTMLButtonElement>}
        aria-label="Drag to reorder"
        data-testid={`output-row-${index}-drag`}
        {...(attributes as unknown as Record<string, unknown>)}
        {...(listeners as unknown as Record<string, unknown>)}
        className="flex h-7 w-5 cursor-grab items-center justify-center rounded text-t3 hover:bg-bg-4 hover:text-t2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <ItemAvatar
        emoji={emoji}
        color={color}
        label={outputKindLabel(output)}
        size="sm"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold text-t1">
          {output.name || "Untitled output"}
        </span>
        {output.description ? (
          <span className="mt-0.5 block truncate text-[11px] text-t3">
            {output.description}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        onClick={() => onRemove(output.id)}
        aria-label="Remove output"
        data-testid={`output-row-${index}-delete`}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-t3 transition hover:bg-bg-4 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

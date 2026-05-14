"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus, Search, SearchX, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { ItemAvatar } from "@/components/framework/item-avatar";
import { OwnerPicker } from "@/components/framework/owner-picker";
import { resolveItemColor } from "@/lib/workflows/skill-colors";
import {
  PlaybookOutputPicker,
  type PlaybookOutputPickerValue,
} from "@/components/workflows/playbook-output-picker";
import type {
  FrameworkItem,
  TemplateOutputGroup,
  WorkflowInput,
} from "@/lib/workflows/types";

interface AddPlaybookModalProps {
  mode?: "create" | "edit";
  /** Skill row this task belongs to (locked context, not a picker). */
  skillId: string;
  skillLabel: string;
  stageId: string;
  stageName: string;
  /** All playbooks loaded by the parent page; modal filters by allowedSkillIds. */
  playbooks: FrameworkItem[];
  initial?: {
    playbookId?: string | null;
    notes?: string;
    owners?: readonly string[];
    inputs?: readonly WorkflowInput[];
  };
  /** Other tasks in the same template — populates the upstream-task select. */
  upstreamTaskOptions?: { id: string; label: string; playbookId?: string | null }[];
  /** Outputs grouped per attached playbook — populates the wiring picker. */
  outputGroups?: TemplateOutputGroup[];
  /** Called by the picker when it wants the parent to refetch (e.g. a
   *  stale-ref save error has fired and the user is reopening the modal). */
  onRefetchOutputs?: () => void | Promise<void>;
  onClose: () => void;
  onSubmit: (input: {
    playbookId: string;
    notes: string;
    owners: string[];
    inputs: WorkflowInput[];
  }) => void;
}

function createInputId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `inp-${crypto.randomUUID()}`;
  }
  return `inp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AddPlaybookModal({
  mode = "create",
  skillId,
  skillLabel,
  stageName,
  playbooks,
  initial,
  upstreamTaskOptions = [],
  outputGroups = [],
  onRefetchOutputs,
  onClose,
  onSubmit,
}: AddPlaybookModalProps) {
  const [selectedId, setSelectedId] = useState<string>(initial?.playbookId ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [owners, setOwners] = useState<string[]>(
    initial?.owners ? [...initial.owners] : [],
  );
  const [inputs, setInputs] = useState<WorkflowInput[]>(() =>
    initial?.inputs ? initial.inputs.map((i) => ({ ...i })) : [],
  );
  const [query, setQuery] = useState("");
  /** True while the user has clicked "Add input" but hasn't picked a value
   *  yet. Drives a transient picker rendered at the bottom of the list;
   *  rows are only pushed into `inputs` once the user actually selects a
   *  playbook output. */
  const [addingDraft, setAddingDraft] = useState(false);

  const allowed = useMemo(
    () =>
      playbooks.filter(
        (pb) => pb.type === "playbook" && (pb.allowedSkillIds ?? []).includes(skillId),
      ),
    [playbooks, skillId],
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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-(--overlay) p-4 backdrop-blur-[3px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          // Drop incomplete (unwired) input rows on submit — they would
          // otherwise persist as a name-less linked input pointing nowhere.
          const wiredInputs = inputs.filter((i) => Boolean(i.upstreamOutputId));
          onSubmit({ playbookId: selectedId, notes, owners, inputs: wiredInputs });
        }}
        className="w-full max-w-[520px] rounded-[14px] border border-border-hi bg-bg-2 p-7 shadow-[var(--shadow-canvas)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-playbook-modal-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div
              id="add-playbook-modal-title"
              className="text-[16px] font-bold tracking-tight text-t1"
            >
              {mode === "edit" ? "Edit playbook" : "Add playbook"}
            </div>
            <div className="mb-4 mt-1 text-[12.5px] text-t3">
              Pick a playbook from your framework library.{" "}
              <Link href="/framework/playbooks" className="text-accent hover:underline">
                Manage playbooks →
              </Link>
            </div>
          </div>
          {allowed.length > 0 ? (
            <OwnerPicker
              values={owners}
              onChange={setOwners}
              variant="stack"
              required={false}
              ariaLabel="Owners"
              stackAvatarSize="sm"
              testIdSuffix="add-playbook-modal"
            />
          ) : null}
        </div>

        {allowed.length === 0 ? (
          <div className="mb-4 rounded-lg border border-dashed border-border-hi bg-bg-3 px-4 py-6 text-center text-[12.5px] text-t3">
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
            <div className="mb-3 rounded-lg border border-border bg-bg-3">
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
                  // Keep the list at a stable height when no matches so the
                  // modal doesn't shrink under the search field while typing.
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

            <div className="mb-5">
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-[11px] font-medium text-t2">
                  Inputs <span className="font-normal text-t3">(optional)</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setAddingDraft(true);
                    void onRefetchOutputs?.();
                  }}
                  disabled={addingDraft || availableForDraft.length === 0}
                  title={
                    availableForDraft.length === 0
                      ? "All available playbook outputs are already wired"
                      : undefined
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-3 px-2 py-1 text-[11px] text-t2 transition hover:bg-bg-4 hover:text-t1 disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="add-input-row"
                >
                  <Plus className="h-3 w-3" /> Add input
                </button>
              </div>
              {inputs.length === 0 && !addingDraft ? (
                <div className="rounded-lg border border-dashed border-border bg-bg-3 px-3 py-3 text-[11.5px] text-t3">
                  No inputs declared.
                </div>
              ) : (
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
                  {addingDraft ? (
                    <li
                      className="flex items-center gap-2 rounded-lg border border-dashed border-border-hi bg-bg-3 px-2.5 py-2"
                      data-testid="input-row-draft"
                    >
                      <PlaybookOutputPicker
                        value={null}
                        available={availableForDraft}
                        playbooks={playbooks}
                        defaultOpen
                        testId="input-row-draft-picker"
                        onChange={(next: PlaybookOutputPickerValue | null) => {
                          if (next === null) {
                            setAddingDraft(false);
                            return;
                          }
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
                          setAddingDraft(false);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setAddingDraft(false)}
                        aria-label="Cancel new input"
                        data-testid="input-row-draft-cancel"
                        className="ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-t3 transition hover:bg-bg-4 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ) : null}
                </ul>
              )}
            </div>

            <details
              className="mb-5 group rounded-lg border border-border bg-bg-3"
              open={notes.trim().length > 0}
            >
              <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-[11px] font-medium text-t2 [&::-webkit-details-marker]:hidden">
                <ChevronDown
                  aria-hidden
                  className="h-3 w-3 text-t3 transition group-open:rotate-180"
                />
                Notes <span className="font-normal text-t3">(optional)</span>
              </summary>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                placeholder="Per-instance context for this playbook"
                className="block w-full resize-none rounded-b-lg border-0 border-t border-border bg-bg-3 px-3 py-2.5 text-[13px] leading-6 text-t1 placeholder:text-t3 focus:outline-none"
              />
            </details>
          </>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
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
        </div>
      </form>
    </div>
  );
}

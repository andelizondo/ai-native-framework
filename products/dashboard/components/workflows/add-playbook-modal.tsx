"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import type { FrameworkItem } from "@/lib/workflows/types";

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
  };
  onClose: () => void;
  onSubmit: (input: { playbookId: string; notes: string }) => void;
}

export function AddPlaybookModal({
  mode = "create",
  skillId,
  skillLabel,
  stageName,
  playbooks,
  initial,
  onClose,
  onSubmit,
}: AddPlaybookModalProps) {
  const [selectedId, setSelectedId] = useState<string>(initial?.playbookId ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [query, setQuery] = useState("");

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
      <div
        className="w-full max-w-[560px] rounded-[14px] border border-border-hi bg-bg-2 p-7 shadow-[var(--shadow-canvas)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-playbook-modal-title"
      >
        <div
          id="add-playbook-modal-title"
          className="text-[16px] font-bold tracking-tight text-t1"
        >
          {mode === "edit" ? "Edit task" : "Add playbook"}
        </div>
        <div className="mb-[18px] mt-1 flex items-center gap-2 text-[12.5px] text-t3">
          <span className="rounded-md border border-border bg-bg-3 px-2 py-0.5 text-[11px] text-t2">
            {skillLabel}
          </span>
          <span>·</span>
          <span>{stageName}</span>
        </div>

        {allowed.length === 0 ? (
          <div className="mb-4 rounded-lg border border-dashed border-border-hi bg-bg-3 px-4 py-6 text-center text-[12.5px] text-t3">
            <div className="mb-2 font-medium text-t2">
              No playbooks allowed for this skill yet
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
            <label className="mb-1.5 block text-[11px] font-medium text-t2">
              Playbook
            </label>
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
              <div className="max-h-56 overflow-y-auto p-1.5">
                {filtered.length === 0 ? (
                  <div className="px-2.5 py-3 text-[11.5px] text-t3">No matches.</div>
                ) : (
                  filtered.map((pb) => {
                    const active = pb.id === selectedId;
                    return (
                      <button
                        key={pb.id}
                        type="button"
                        onClick={() => setSelectedId(pb.id)}
                        className={cn(
                          "flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition",
                          active
                            ? "bg-primary-bg text-accent"
                            : "text-t2 hover:bg-bg-4 hover:text-t1",
                        )}
                      >
                        <span className="mt-0.5 text-[14px]">{pb.icon || "•"}</span>
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

            <label className="mb-1.5 block text-[11px] font-medium text-t2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder="Per-instance context for this task"
              className="mb-5 block w-full resize-none rounded-lg border border-border bg-bg-3 px-3 py-2.5 text-[13px] leading-6 text-t1 placeholder:text-t3 focus:border-primary focus:outline-none"
            />
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
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              if (!canSubmit) return;
              onSubmit({ playbookId: selectedId, notes });
            }}
            className="rounded-lg bg-primary px-5 py-2 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mode === "edit" ? "Save task →" : "Add task →"}
          </button>
        </div>
      </div>
    </div>
  );
}

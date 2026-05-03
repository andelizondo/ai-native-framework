"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import type { FrameworkItem, WorkflowSkill } from "@/lib/workflows/types";
import { cn } from "@/lib/utils";

interface AddSkillModalProps {
  mode?: "create" | "edit";
  initialSkill?: Pick<WorkflowSkill, "id" | "label" | "owner">;
  /** All `framework_items` of type 'skill', loaded by the parent page. */
  skills: FrameworkItem[];
  /** Skill ids already used as rows in the current matrix — disabled in the picker. */
  alreadyUsedIds?: string[];
  onClose: () => void;
  onSubmit: (skill: Pick<WorkflowSkill, "id" | "label" | "owner">) => void;
}

export function AddSkillModal({
  mode = "create",
  initialSkill,
  skills,
  alreadyUsedIds = [],
  onClose,
  onSubmit,
}: AddSkillModalProps) {
  const [selectedId, setSelectedId] = useState<string>(initialSkill?.id ?? "");
  const [query, setQuery] = useState("");

  const usedIdSet = useMemo(
    () => new Set(alreadyUsedIds.filter((id) => id !== initialSkill?.id)),
    [alreadyUsedIds, initialSkill?.id],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter((s) =>
      [s.name, s.description].some((field) => field.toLowerCase().includes(q)),
    );
  }, [skills, query]);

  const selected = skills.find((s) => s.id === selectedId);
  const canSubmit = Boolean(selected);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
        className="w-full max-w-[520px] rounded-[14px] border border-border-hi bg-bg-2 p-7 shadow-[var(--shadow-canvas)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-skill-modal-title"
      >
        <div id="add-skill-modal-title" className="text-[16px] font-bold tracking-tight text-t1">
          {mode === "edit" ? "Edit skill" : "Add skill"}
        </div>
        <div className="mb-4 mt-1 text-[12.5px] text-t3">
          Pick a skill from your framework library.{" "}
          <Link href="/framework/skills" className="text-accent hover:underline">
            Manage skills →
          </Link>
        </div>

        {skills.length === 0 ? (
          <div className="mb-4 rounded-lg border border-dashed border-border-hi bg-bg-3 px-4 py-6 text-center text-[12.5px] text-t3">
            <div className="mb-2 font-medium text-t2">No skills defined yet</div>
            <Link
              href="/framework/skills"
              className="text-[12px] text-accent hover:underline"
            >
              Create one in the Skills page →
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
                  placeholder="Search skills"
                  autoFocus
                  className="w-full bg-transparent text-[13px] text-t1 placeholder:text-t3 focus:outline-none"
                />
              </div>
              <div className="max-h-60 overflow-y-auto p-1.5">
                {filtered.length === 0 ? (
                  <div className="px-2.5 py-3 text-[11.5px] text-t3">No matches.</div>
                ) : (
                  filtered.map((skill) => {
                    const used = usedIdSet.has(skill.id);
                    const active = skill.id === selectedId;
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        disabled={used}
                        onClick={() => setSelectedId(skill.id)}
                        className={cn(
                          "flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition",
                          active
                            ? "bg-primary-bg text-accent"
                            : used
                              ? "cursor-not-allowed text-t3 opacity-60"
                              : "text-t2 hover:bg-bg-4 hover:text-t1",
                        )}
                      >
                        <span className="mt-0.5 text-[14px]">{skill.icon || "•"}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-semibold">
                            {skill.name}
                            {used ? <span className="ml-2 text-[10px] text-t3">already added</span> : null}
                          </span>
                          {skill.description ? (
                            <span className="mt-0.5 block truncate text-[10.5px] text-t3">
                              {skill.description}
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
              Owner
            </label>
            <button
              type="button"
              disabled
              className="mb-5 block w-full cursor-not-allowed rounded-lg border border-border bg-bg-3 px-3 py-2.5 text-left text-[12.5px] text-t3"
              title="Coming soon"
            >
              {initialSkill?.owner?.trim() || "Assign agent or persona — coming soon"}
            </button>
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
              if (!selected) return;
              onSubmit({
                id: selected.id,
                label: selected.name,
                owner: initialSkill?.owner,
              });
              onClose();
            }}
            className="rounded-lg bg-primary px-5 py-2 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mode === "edit" ? "Save skill →" : "Add skill →"}
          </button>
        </div>
      </div>
    </div>
  );
}

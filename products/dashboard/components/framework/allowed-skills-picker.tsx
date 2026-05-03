"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Check, Plus, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { SKILL_COLORS } from "@/lib/workflows/skill-colors";
import type { FrameworkItem } from "@/lib/workflows/types";

interface AllowedSkillsPickerProps {
  /** Skill ids currently allowed (subset of `availableSkills` ids). */
  value: readonly string[];
  /** All `framework_items` of type 'skill'. */
  availableSkills: readonly FrameworkItem[];
  onChange: (next: string[]) => void;
}

/**
 * Stable per-skill palette index. Same skill id always maps to the same
 * SKILL_COLORS entry across the app, regardless of which skill subset the
 * avatar is rendered in. djb2-ish hash — fast and good enough for a fixed
 * 8-color palette.
 */
function hashIndex(id: string, len: number): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % len;
}

function colorForSkill(id: string): string {
  return SKILL_COLORS[hashIndex(id, SKILL_COLORS.length)]!;
}

function SkillAvatar({
  skill,
  index,
  total,
}: {
  skill: FrameworkItem;
  index: number;
  total: number;
}) {
  const color = colorForSkill(skill.id);
  return (
    <span
      role="img"
      aria-label={skill.name}
      className="group/avatar relative flex h-8 w-8 items-center justify-center rounded-full bg-bg-2 text-[14px] leading-none transition-transform hover:z-50 hover:-translate-y-px"
      style={{
        marginLeft: index === 0 ? 0 : -8,
        zIndex: total - index,
        border: `1.5px solid ${color}`,
        boxShadow: `0 0 0 2px ${color}1f`,
      }}
    >
      <span aria-hidden>{skill.icon || "•"}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-[calc(100%+6px)] z-[60] -translate-x-1/2 whitespace-nowrap rounded-md border border-border-hi bg-bg-2 px-2 py-1 text-[11px] font-medium text-t1 opacity-0 shadow-[var(--shadow-canvas)] transition-opacity duration-100 group-hover/avatar:opacity-100"
      >
        {skill.name}
      </span>
    </span>
  );
}

export function AllowedSkillsPicker({
  value,
  availableSkills,
  onChange,
}: AllowedSkillsPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const headingId = useId();

  const valueSet = useMemo(() => new Set(value), [value]);
  const allowedSkills = useMemo(
    () => availableSkills.filter((s) => valueSet.has(s.id)),
    [availableSkills, valueSet],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return availableSkills;
    return availableSkills.filter((s) =>
      [s.name, s.description].some((field) => field.toLowerCase().includes(q)),
    );
  }, [availableSkills, query]);

  // Close on outside click / Escape — same pattern as ColorDot.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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

  // Focus the search input when the dropdown opens so the keyboard path
  // stays seamless after Enter on the trigger.
  useEffect(() => {
    if (open) {
      searchRef.current?.focus();
    } else {
      setQuery("");
    }
  }, [open]);

  function toggleSkill(id: string) {
    const set = new Set(value);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange(Array.from(set));
  }

  const triggerLabel =
    allowedSkills.length === 0 ? "Add allowed skills" : "Edit allowed skills";

  return (
    <div ref={rootRef} className={cn("relative inline-flex items-center")}>
      <span className="group/trigger relative">
        <button
          type="button"
          aria-label={triggerLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          data-testid="allowed-skills-trigger"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border border-dashed text-t3 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            open
              ? "border-accent bg-primary-bg text-accent"
              : "border-border-hi hover:bg-bg-3 hover:text-t1",
          )}
        >
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2.25} />
        </button>
        {!open ? (
          <span
            role="tooltip"
            className="pointer-events-none absolute left-0 top-[calc(100%+6px)] z-[60] whitespace-nowrap rounded-md border border-border-hi bg-bg-2 px-2 py-1 text-[11px] font-medium text-t1 opacity-0 shadow-[var(--shadow-canvas)] transition-opacity duration-100 group-hover/trigger:opacity-100"
          >
            {triggerLabel}
          </span>
        ) : null}
      </span>

      <div
        className="ml-2 flex items-center"
        data-testid="allowed-skills-avatars"
      >
        {allowedSkills.map((skill, index) => (
          <SkillAvatar
            key={skill.id}
            skill={skill}
            index={index}
            total={allowedSkills.length}
          />
        ))}
      </div>

      {open ? (
        <div
          role="dialog"
          aria-labelledby={headingId}
          className="absolute left-0 top-[calc(100%+8px)] z-40 w-[280px] overflow-hidden rounded-[12px] border border-border-hi bg-bg-2 shadow-[var(--shadow-canvas)]"
          data-testid="allowed-skills-dropdown"
        >
          <div className="border-b border-border px-3 py-2.5">
            <div
              id={headingId}
              className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-t3"
            >
              Allowed skills
            </div>
            <div className="mt-1 text-[11.5px] leading-[1.5] text-t3">
              Pick which skills can run this playbook.
            </div>
          </div>

          {availableSkills.length === 0 ? (
            <div className="px-3 py-6 text-center text-[12px] text-t3">
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
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <Search aria-hidden className="h-3.5 w-3.5 text-t3" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search skills"
                  className="w-full bg-transparent text-[12.5px] text-t1 placeholder:text-t3 focus:outline-none"
                />
              </div>
              <div className="max-h-[260px] overflow-y-auto p-1.5">
                {filtered.length === 0 ? (
                  <div className="px-2.5 py-3 text-[11.5px] text-t3">
                    No matches.
                  </div>
                ) : (
                  filtered.map((skill) => {
                    const checked = valueSet.has(skill.id);
                    const color = colorForSkill(skill.id);
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => toggleSkill(skill.id)}
                        data-testid={`allowed-skills-item-${skill.id}`}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition",
                          checked
                            ? "bg-primary-bg text-t1"
                            : "text-t2 hover:bg-bg-3 hover:text-t1",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                            checked
                              ? "border-accent bg-accent text-white"
                              : "border-border bg-bg-3",
                          )}
                        >
                          {checked ? (
                            <Check className="h-3 w-3" strokeWidth={3} />
                          ) : null}
                        </span>
                        <span
                          aria-hidden
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px]"
                          style={{
                            border: `1.5px solid ${color}`,
                            boxShadow: `0 0 0 2px ${color}1f`,
                            background: "var(--bg-2)",
                          }}
                        >
                          <span>{skill.icon || "•"}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-semibold">
                            {skill.name}
                          </span>
                          {skill.description ? (
                            <span className="mt-[1px] block truncate text-[10.5px] text-t3">
                              {skill.description}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

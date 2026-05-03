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

import { ItemAvatar } from "@/components/framework/item-avatar";
import { cn } from "@/lib/utils";
import { resolveItemColor } from "@/lib/workflows/skill-colors";
import type { FrameworkItem } from "@/lib/workflows/types";

type PickerKind = "skills" | "playbooks";

interface AllowedItemsPickerProps {
  /** The picker's flavor — drives copy and the empty-state link target. */
  kind: PickerKind;
  /** Item ids currently allowed (subset of `available` ids). */
  value: readonly string[];
  /** All `framework_items` of the matching type. */
  available: readonly FrameworkItem[];
  onChange: (next: string[]) => void;
}

const COPY: Record<
  PickerKind,
  {
    heading: string;
    blurb: string;
    addLabel: string;
    editLabel: string;
    searchPlaceholder: string;
    emptyTitle: string;
    emptyHref: string;
    emptyCta: string;
  }
> = {
  skills: {
    heading: "Allowed skills",
    blurb: "Pick which skills can run this playbook.",
    addLabel: "Add allowed skills",
    editLabel: "Edit allowed skills",
    searchPlaceholder: "Search skills",
    emptyTitle: "No skills defined yet",
    emptyHref: "/framework/skills",
    emptyCta: "Create one in the Skills page →",
  },
  playbooks: {
    heading: "Allowed playbooks",
    blurb: "Pick which playbooks this skill can run.",
    addLabel: "Add allowed playbooks",
    editLabel: "Edit allowed playbooks",
    searchPlaceholder: "Search playbooks",
    emptyTitle: "No playbooks defined yet",
    emptyHref: "/framework/playbooks",
    emptyCta: "Create one in the Playbooks page →",
  },
};

export function AllowedItemsPicker({
  kind,
  value,
  available,
  onChange,
}: AllowedItemsPickerProps) {
  const copy = COPY[kind];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const headingId = useId();

  const valueSet = useMemo(() => new Set(value), [value]);
  const allowed = useMemo(
    () => available.filter((s) => valueSet.has(s.id)),
    [available, valueSet],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter((s) =>
      [s.name, s.description].some((field) => field.toLowerCase().includes(q)),
    );
  }, [available, query]);

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

  function toggleItem(id: string) {
    const set = new Set(value);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange(Array.from(set));
  }

  const triggerLabel = allowed.length === 0 ? copy.addLabel : copy.editLabel;
  const testIdSuffix = kind === "skills" ? "skills" : "playbooks";

  return (
    <div ref={rootRef} className={cn("relative inline-flex items-center")}>
      <span className="group/trigger relative">
        <button
          type="button"
          aria-label={triggerLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          data-testid={`allowed-${testIdSuffix}-trigger`}
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
        data-testid={`allowed-${testIdSuffix}-avatars`}
      >
        {allowed.map((item, index) => (
          <ItemAvatar
            key={item.id}
            emoji={item.icon}
            color={resolveItemColor(item)}
            label={item.name}
            size="md"
            withTooltip
            stackIndex={index}
            stackTotal={allowed.length}
          />
        ))}
      </div>

      {open ? (
        <div
          role="dialog"
          aria-labelledby={headingId}
          className="absolute left-0 top-[calc(100%+8px)] z-40 w-[280px] overflow-hidden rounded-[12px] border border-border-hi bg-bg-2 shadow-[var(--shadow-canvas)]"
          data-testid={`allowed-${testIdSuffix}-dropdown`}
        >
          <div className="border-b border-border px-3 py-2.5">
            <div
              id={headingId}
              className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-t3"
            >
              {copy.heading}
            </div>
            <div className="mt-1 text-[11.5px] leading-[1.5] text-t3">
              {copy.blurb}
            </div>
          </div>

          {available.length === 0 ? (
            <div className="px-3 py-6 text-center text-[12px] text-t3">
              <div className="mb-2 font-medium text-t2">{copy.emptyTitle}</div>
              <Link
                href={copy.emptyHref}
                className="text-[12px] text-accent hover:underline"
              >
                {copy.emptyCta}
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
                  placeholder={copy.searchPlaceholder}
                  className="w-full bg-transparent text-[12.5px] text-t1 placeholder:text-t3 focus:outline-none"
                />
              </div>
              <div className="max-h-[260px] overflow-y-auto p-1.5">
                {filtered.length === 0 ? (
                  <div className="px-2.5 py-3 text-[11.5px] text-t3">
                    No matches.
                  </div>
                ) : (
                  filtered.map((item) => {
                    const checked = valueSet.has(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => toggleItem(item.id)}
                        data-testid={`allowed-${testIdSuffix}-item-${item.id}`}
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
                        <ItemAvatar
                          emoji={item.icon}
                          color={resolveItemColor(item)}
                          label={item.name}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-semibold">
                            {item.name}
                          </span>
                          {item.description ? (
                            <span className="mt-[1px] block truncate text-[10.5px] text-t3">
                              {item.description}
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

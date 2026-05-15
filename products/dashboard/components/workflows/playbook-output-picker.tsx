"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Check, ChevronDown, Search, X } from "lucide-react";

import { ItemAvatar } from "@/components/framework/item-avatar";
import { resolveItemColor } from "@/lib/workflows/skill-colors";
import { cn } from "@/lib/utils";
import type { FrameworkItem, TemplateOutputGroup } from "@/lib/workflows/types";

/**
 * Single-select playbook + output picker. Styled like AllowedItemsPicker
 * (popover with search) to replace the previous native <select> chain.
 *
 * Flow:
 *   1. User clicks the trigger.
 *   2. A search popover lists every available `{playbook → output}` pair.
 *   3. Selecting one stamps both `upstreamOutputId` and `playbookId`.
 *
 * When `value` is set, the trigger renders as a compact wiring chip
 * ("Playbook · Output / Kind" with an inline clear button).
 */

export interface PlaybookOutputPickerValue {
  outputId: string;
  playbookId: string;
}

export interface PlaybookOutputPickerProps {
  value: PlaybookOutputPickerValue | null;
  /** Groups of outputs available to this template/instance. */
  available: readonly TemplateOutputGroup[];
  /** Optional list of all playbooks — used to render icons/colors in chip. */
  playbooks?: readonly FrameworkItem[];
  onChange: (next: PlaybookOutputPickerValue | null) => void;
  /** Anchor side for the popover. Defaults to "start". */
  align?: "start" | "end";
  /** Force the picker open on mount. Useful for fresh draft rows. */
  defaultOpen?: boolean;
  /** Optional test id suffix for the trigger + dropdown. */
  testId?: string;
  /** When true, the "Pick playbook output…" trigger expands to fill the
   *  available width and uses the same padding/sizing as the inputs editor's
   *  "+ Add input" button. Use when the trigger replaces a full-width row
   *  affordance (e.g. the add/edit playbook drawer's draft input row). */
  fullWidthTrigger?: boolean;
  /** Override the trigger button's label. Defaults to "Pick playbook
   *  output…". The trailing chevron stays so the affordance still reads
   *  as a dropdown toggle. */
  triggerLabel?: string;
  /** Render a custom icon at the leading edge of the trigger (replaces
   *  the default leading state — no icon when omitted). */
  triggerLeadingIcon?: ReactNode;
  /** Hide the trailing chevron on the trigger. Useful when the trigger
   *  is presented as a primary action button (e.g. "+ Add input") rather
   *  than a dropdown affordance. */
  hideTriggerChevron?: boolean;
}

export function PlaybookOutputPicker({
  value,
  available,
  playbooks = [],
  onChange,
  align = "start",
  defaultOpen = false,
  testId = "playbook-output",
  fullWidthTrigger = false,
  triggerLabel = "Pick playbook output…",
  triggerLeadingIcon,
  hideTriggerChevron = false,
}: PlaybookOutputPickerProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  // Absolute viewport-anchored coordinates the portalled dropdown uses.
  // `triggerTop` / `triggerBottom` are kept separately so the dropdown can
  // auto-flip above the trigger when there isn't enough room below.
  // null while closed or before the first measurement.
  const [anchorRect, setAnchorRect] = useState<{
    triggerTop: number;
    triggerBottom: number;
    left: number;
    right: number;
    width: number;
  } | null>(null);

  const playbookById = useMemo(() => {
    const map = new Map<string, FrameworkItem>();
    for (const pb of playbooks) map.set(pb.id, pb);
    return map;
  }, [playbooks]);

  const wiredGroup = useMemo(() => {
    if (!value) return null;
    return available.find((g) => g.playbookId === value.playbookId) ?? null;
  }, [available, value]);
  const wiredOutput = useMemo(() => {
    if (!value || !wiredGroup) return null;
    return wiredGroup.outputs.find((o) => o.id === value.outputId) ?? null;
  }, [wiredGroup, value]);

  // Flatten + filter.
  const flat = useMemo(() => {
    const rows: {
      key: string;
      playbookId: string;
      playbookName: string;
      outputId: string;
      outputName: string;
      kind: string | null;
    }[] = [];
    for (const group of available) {
      for (const output of group.outputs) {
        rows.push({
          key: `${group.playbookId}::${output.id}`,
          playbookId: group.playbookId,
          playbookName: group.playbookName,
          outputId: output.id,
          outputName: output.name,
          kind: (output as { kind?: string | null }).kind ?? null,
        });
      }
    }
    return rows;
  }, [available]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return flat;
    return flat.filter((row) =>
      [row.playbookName, row.outputName].some((field) =>
        field.toLowerCase().includes(q),
      ),
    );
  }, [flat, query]);

  // Close on outside click / Escape. Includes the portalled dropdown via
  // dropdownRef so clicks inside the dropdown don't immediately close.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
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

  // Measure the trigger so the portalled dropdown can anchor under it.
  // Re-measure on scroll/resize while open so the popover stays glued.
  useLayoutEffect(() => {
    if (!open) {
      setAnchorRect(null);
      return;
    }
    function measure() {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setAnchorRect({
        triggerTop: rect.top,
        triggerBottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
      });
    }
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      // preventScroll: trigger may sit at the edge of a modal; without
      // this the browser would shift the modal to keep search in view.
      searchRef.current?.focus({ preventScroll: true });
    } else {
      setQuery("");
    }
  }, [open]);

  const currentKey =
    wiredGroup && wiredOutput
      ? `${wiredGroup.playbookId}::${wiredOutput.id}`
      : null;

  const dropdown =
    open && anchorRect && typeof document !== "undefined"
      ? createPortal(
          <PortalDropdown
            ref={dropdownRef}
            anchorRect={anchorRect}
            align={align}
            testId={testId}
            available={available}
            filtered={filtered}
            playbookById={playbookById}
            query={query}
            setQuery={setQuery}
            searchRef={searchRef}
            currentKey={currentKey}
            onPick={(row) => {
              onChange({ outputId: row.outputId, playbookId: row.playbookId });
              setOpen(false);
            }}
          />,
          document.body,
        )
      : null;

  // If we already have a wired value, render the compact chip.
  if (wiredOutput && wiredGroup) {
    const playbook = playbookById.get(wiredGroup.playbookId);
    return (
      <div ref={rootRef} className="relative inline-flex max-w-full items-center">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          data-testid={`${testId}-trigger`}
          className={cn(
            "flex min-w-0 items-center gap-2 rounded-md border border-border bg-bg-3 px-2 py-1 text-[12px] text-t1 transition hover:bg-bg-4 hover:border-border-hi focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            open && "border-accent",
          )}
        >
          {playbook ? (
            <ItemAvatar
              emoji={playbook.icon}
              color={resolveItemColor(playbook)}
              label={playbook.name}
              size="sm"
            />
          ) : null}
          <span className="min-w-0 truncate font-medium">
            {wiredGroup.playbookName}
          </span>
          <span aria-hidden className="text-t3">/</span>
          <span className="min-w-0 truncate text-t2">{wiredOutput.name}</span>
          <ChevronDown
            aria-hidden
            className={cn("h-3 w-3 shrink-0 text-t3 transition", open && "rotate-180")}
          />
        </button>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
          aria-label="Clear wiring"
          data-testid={`${testId}-clear`}
          className="ml-1 rounded p-1 text-t3 transition hover:bg-bg-4 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <X className="h-3 w-3" />
        </button>
        {dropdown}
      </div>
    );
  }

  // Otherwise render an "Add from playbook…" trigger.
  return (
    <div
      ref={rootRef}
      className={cn(
        "relative max-w-full items-center",
        fullWidthTrigger ? "flex flex-1 min-w-0" : "inline-flex",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid={`${testId}-trigger`}
        className={cn(
          "items-center rounded-md border border-dashed border-border bg-transparent text-t3 transition hover:border-border-hi hover:bg-bg-2 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          fullWidthTrigger
            ? "flex w-full justify-center gap-1.5 px-4 py-3 text-[12px] font-medium"
            : "flex min-w-0 gap-1.5 px-2.5 py-1 text-[12px]",
          open && "border-accent text-t1",
        )}
      >
        {triggerLeadingIcon ?? null}
        <span>{triggerLabel}</span>
        {hideTriggerChevron ? null : (
          <ChevronDown
            aria-hidden
            className={cn("h-3 w-3 text-t3 transition", open && "rotate-180")}
          />
        )}
      </button>
      {dropdown}
    </div>
  );
}

type FilteredRow = {
  key: string;
  playbookId: string;
  playbookName: string;
  outputId: string;
  outputName: string;
  kind: string | null;
};

const PORTAL_DROPDOWN_WIDTH = 320;

interface PortalDropdownProps {
  ref: React.RefObject<HTMLDivElement | null>;
  anchorRect: {
    triggerTop: number;
    triggerBottom: number;
    left: number;
    right: number;
    width: number;
  };
  align: "start" | "end";
  testId: string;
  available: readonly TemplateOutputGroup[];
  filtered: FilteredRow[];
  playbookById: Map<string, FrameworkItem>;
  query: string;
  setQuery: (next: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  currentKey: string | null;
  onPick: (row: FilteredRow) => void;
}

function PortalDropdown({
  ref,
  anchorRect,
  align,
  testId,
  available,
  filtered,
  playbookById,
  query,
  setQuery,
  searchRef,
  currentKey,
  onPick,
}: PortalDropdownProps) {
  // Group filtered rows by playbook so the dropdown reads as "Playbook A →
  // its outputs, Playbook B → its outputs," matching the original two-step
  // mental model.
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { playbookId: string; playbookName: string; rows: FilteredRow[] }
    >();
    for (const row of filtered) {
      let bucket = map.get(row.playbookId);
      if (!bucket) {
        bucket = {
          playbookId: row.playbookId,
          playbookName: row.playbookName,
          rows: [],
        };
        map.set(row.playbookId, bucket);
      }
      bucket.rows.push(row);
    }
    return Array.from(map.values());
  }, [filtered]);

  // Position: by default anchor below the trigger. When there isn't enough
  // room below (e.g. the picker sits near the viewport's bottom edge), flip
  // and anchor above so the dropdown remains fully visible.
  const viewportWidth =
    typeof window !== "undefined" ? window.innerWidth : 1024;
  const viewportHeight =
    typeof window !== "undefined" ? window.innerHeight : 768;
  // Approximate dropdown height: header (~38) + search (~38) + list max-h
  // (280) + bottom padding (~16) ≈ 372. Add some breathing room.
  const ESTIMATED_HEIGHT = 392;
  const spaceBelow = viewportHeight - anchorRect.triggerBottom;
  const spaceAbove = anchorRect.triggerTop;
  const openUp = spaceBelow < ESTIMATED_HEIGHT && spaceAbove > spaceBelow;
  const positionStyle: React.CSSProperties = openUp
    ? { bottom: Math.max(8, viewportHeight - anchorRect.triggerTop + 8) }
    : { top: anchorRect.triggerBottom + 8 };
  let left =
    align === "end"
      ? anchorRect.right - PORTAL_DROPDOWN_WIDTH
      : anchorRect.left;
  // Clamp horizontally so the dropdown stays inside the viewport.
  left = Math.max(8, Math.min(left, viewportWidth - PORTAL_DROPDOWN_WIDTH - 8));

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Playbook outputs"
      style={{ ...positionStyle, left, width: PORTAL_DROPDOWN_WIDTH }}
      data-open-direction={openUp ? "up" : "down"}
      className="fixed z-[80] overflow-hidden rounded-[12px] border border-border-hi bg-bg-2 shadow-[var(--shadow-canvas)]"
      data-testid={`${testId}-dropdown`}
    >
      {available.length === 0 ? (
        <div className="px-3 py-6 text-center text-[12px] text-t3">
          <div className="mb-2 font-medium text-t2">No playbook outputs yet</div>
          <Link
            href="/framework/playbooks"
            className="text-[12px] text-accent hover:underline"
          >
            Declare outputs on a playbook →
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
              placeholder="Search playbook · output"
              className="w-full bg-transparent text-[12.5px] text-t1 placeholder:text-t3 focus:outline-none"
              data-testid={`${testId}-search`}
            />
          </div>
          <div className="max-h-[280px] overflow-y-auto p-1.5">
            {grouped.length === 0 ? (
              <div className="px-2.5 py-3 text-[11.5px] text-t3">No matches.</div>
            ) : (
              grouped.map((group) => {
                const playbook = playbookById.get(group.playbookId);
                return (
                  <div
                    key={group.playbookId}
                    className="mb-1 last:mb-0"
                    data-testid={`${testId}-group-${group.playbookId}`}
                  >
                    <div className="sticky top-0 z-10 -mx-1.5 flex items-center gap-1.5 border-b border-border bg-bg-2 px-3 py-1.5">
                      {playbook ? (
                        <ItemAvatar
                          emoji={playbook.icon}
                          color={resolveItemColor(playbook)}
                          label={playbook.name}
                          size="xs"
                        />
                      ) : null}
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-t3">
                        {group.playbookName}
                      </span>
                    </div>
                    {group.rows.map((row) => {
                      const checked = row.key === currentKey;
                      return (
                        <button
                          key={row.key}
                          type="button"
                          role="option"
                          aria-selected={checked}
                          onClick={() => onPick(row)}
                          data-testid={`${testId}-item-${row.outputId}`}
                          className={cn(
                            "mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition",
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
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12.5px] font-medium">
                              {row.outputName}
                            </span>
                            {row.kind ? (
                              <span className="mt-[1px] block truncate text-[10.5px] text-t3">
                                {row.kind}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

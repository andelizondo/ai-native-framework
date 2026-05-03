"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  ChevronDown,
  Sparkles,
  User2,
  X as XIcon,
} from "lucide-react";

import { ItemAvatar } from "@/components/framework/item-avatar";
import {
  AGENT_OWNERS,
  PEOPLE_OWNERS,
  findOwnerByLabel,
  type OwnerOption,
} from "@/lib/framework/owner-catalog";
import { cn } from "@/lib/utils";

interface OwnerPickerProps {
  /** Currently selected owner labels. */
  values: readonly string[];
  onChange: (next: string[]) => void;
  /** Visual treatment — `inline` for a clickable row affordance, `field`
   *  for a full form-style trigger inside a modal. */
  variant?: "inline" | "field";
  placeholder?: string;
  ariaLabel?: string;
  /** When true, prevent removing the last owner (parent enforces ≥1). */
  required?: boolean;
}

const GROUP_TITLE: Record<"people" | "agents", string> = {
  people: "People",
  agents: "AI Agents",
};

const DROPDOWN_WIDTH = 280;
/** Minimum vertical room we need to render the dropdown without overflowing
 *  the viewport. Anything tighter and we flip to render above the trigger. */
const DROPDOWN_MIN_HEIGHT = 320;
const VIEWPORT_MARGIN = 12;

/** Lookup helper so chip rendering can resolve avatar metadata for the
 *  catalog options the user previously picked. */
function findOption(label: string): OwnerOption | undefined {
  return findOwnerByLabel(label) ?? undefined;
}

/**
 * Multi-select owner dropdown. Picks one or more owners (people + AI
 * agents) from the curated catalog. Avatars + subtitles match the
 * allowed-skills/playbooks picker so the two pickers feel like one design.
 */
export function OwnerPicker({
  values,
  onChange,
  variant = "inline",
  placeholder = "Set owner",
  ariaLabel,
  required = false,
}: OwnerPickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"below" | "above">("below");
  const [maxBodyHeight, setMaxBodyHeight] = useState<number>(320);
  const headingId = useId();

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

  // Viewport-aware placement: open above when there isn't enough room below.
  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;

    function compute() {
      const trigger = rootRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const viewportH =
        typeof window !== "undefined" ? window.innerHeight : 0;
      const spaceBelow = viewportH - trigger.bottom - VIEWPORT_MARGIN;
      const spaceAbove = trigger.top - VIEWPORT_MARGIN;

      if (spaceBelow >= DROPDOWN_MIN_HEIGHT || spaceBelow >= spaceAbove) {
        setPlacement("below");
        setMaxBodyHeight(Math.max(180, Math.min(360, spaceBelow - 80)));
      } else {
        setPlacement("above");
        setMaxBodyHeight(Math.max(180, Math.min(360, spaceAbove - 80)));
      }
    }

    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [open]);

  // Drop any owners that don't bind to the catalog. Older seeded skills
  // carry compound labels like "Hans / Dave" that pre-date the structured
  // catalog; surfacing them as unselectable chips is more confusing than
  // helpful. The next `onChange` from this picker writes back only the
  // catalog-matched set, so a single edit cleans up the legacy data.
  const trimmedValues = useMemo(
    () =>
      values
        .map((v) => v.trim())
        .filter((label) => label.length > 0 && findOwnerByLabel(label) !== null),
    [values],
  );
  const valueSet = useMemo(() => new Set(trimmedValues), [trimmedValues]);
  const hasValues = trimmedValues.length > 0;
  const groups = useMemo(
    () => ({ people: PEOPLE_OWNERS, agents: AGENT_OWNERS }),
    [],
  );

  function toggleOption(option: OwnerOption) {
    const next = new Set(trimmedValues);
    if (next.has(option.label)) {
      if (required && next.size === 1) return;
      next.delete(option.label);
    } else {
      next.add(option.label);
    }
    onChange(Array.from(next));
  }

  function removeOwner(label: string) {
    if (required && trimmedValues.length === 1) return;
    onChange(trimmedValues.filter((v) => v !== label));
  }

  const triggerLabel = hasValues ? trimmedValues.join(", ") : placeholder;

  return (
    <div ref={rootRef} className="relative inline-flex w-full">
      {variant === "field" ? (
        <button
          type="button"
          aria-label={ariaLabel ?? "Pick owners"}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          /* Fixed min-height so adding chips doesn't grow the field. The
           * chip area scrolls horizontally past the trigger width once it
           * runs out of room — keeps the form from reflowing on every
           * selection. */
          className="flex min-h-[42px] w-full items-center justify-between gap-2 rounded-lg border border-border bg-bg-3 px-3 py-1.5 text-left text-[12.5px] text-t1 transition hover:border-border-hi focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {hasValues ? (
            <span className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto">
              {trimmedValues.map((label) => {
                const option = findOption(label);
                return (
                  <span
                    key={label}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-bg-2 py-[3px] pl-[3px] pr-2 text-[11.5px] text-t1"
                  >
                    {option ? (
                      <ItemAvatar
                        emoji={option.emoji}
                        initials={option.initials}
                        color={option.color}
                        label={option.label}
                        size="xs"
                      />
                    ) : null}
                    {label}
                    {required && trimmedValues.length === 1 ? null : (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Remove ${label}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          removeOwner(label);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            removeOwner(label);
                          }
                        }}
                        className="-mr-0.5 ml-0.5 rounded-full p-[1px] text-t3 transition hover:bg-bg-3 hover:text-t1"
                      >
                        <XIcon className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </span>
                );
              })}
            </span>
          ) : (
            <span className="truncate text-t3">{placeholder}</span>
          )}
          <ChevronDown aria-hidden className="h-3.5 w-3.5 shrink-0 text-t3" />
        </button>
      ) : (
        <button
          type="button"
          aria-label={ariaLabel ?? "Change owners"}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "max-w-full rounded-md text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            hasValues
              ? "text-t3 hover:text-t1"
              : "text-t3 italic hover:text-t1",
          )}
        >
          {/* Clamp the displayed label to 2 lines so a long comma-separated
            * owner list never blows up the row. We clamp on this inner span
            * instead of the row container so the dropdown popover (rendered
            * as a sibling absolute element) stays unclipped. */}
          <span
            className="block overflow-hidden text-ellipsis"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {triggerLabel}
          </span>
        </button>
      )}

      {open ? (
        <div
          role="dialog"
          aria-labelledby={headingId}
          style={{ width: DROPDOWN_WIDTH }}
          className={cn(
            "absolute left-0 z-40 overflow-hidden rounded-[12px] border border-border-hi bg-bg-2 shadow-[var(--shadow-canvas)]",
            placement === "below"
              ? "top-[calc(100%+8px)]"
              : "bottom-[calc(100%+8px)]",
          )}
        >
          <div className="border-b border-border px-3 py-2.5">
            <div
              id={headingId}
              className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-t3"
            >
              Owners
            </div>
            <div className="mt-1 text-[11.5px] leading-[1.5] text-t3">
              Pick one or more people or AI agents.
            </div>
          </div>
          <div
            className="overflow-y-auto p-1.5"
            style={{ maxHeight: maxBodyHeight }}
          >
            {(["people", "agents"] as const).map((group) => {
              const list = groups[group];
              return (
                <div key={group} className="mb-1.5 last:mb-0">
                  <div className="flex items-center gap-1.5 px-2 pb-1 pt-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-t3">
                    {group === "people" ? (
                      <User2 aria-hidden className="h-3 w-3" />
                    ) : (
                      <Sparkles aria-hidden className="h-3 w-3" />
                    )}
                    {GROUP_TITLE[group]}
                  </div>
                  {list.map((option) => {
                    const checked = valueSet.has(option.label);
                    const isLastChecked =
                      required && checked && trimmedValues.length === 1;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        disabled={isLastChecked}
                        title={
                          isLastChecked
                            ? "At least one owner is required"
                            : undefined
                        }
                        onClick={() => toggleOption(option)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition",
                          checked
                            ? "bg-primary-bg text-t1"
                            : "text-t2 hover:bg-bg-3 hover:text-t1",
                          isLastChecked && "cursor-not-allowed opacity-70",
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
                          emoji={option.emoji}
                          initials={option.initials}
                          color={option.color}
                          label={option.label}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-semibold">
                            {option.label}
                          </span>
                          <span className="mt-[1px] block truncate text-[10.5px] text-t3">
                            {option.subtitle}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

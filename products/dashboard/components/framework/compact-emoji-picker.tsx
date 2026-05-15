"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

import {
  ALL_EMOJIS,
  EMOJI_CATEGORIES,
  type EmojiEntry,
} from "@/lib/framework/emoji-catalog";
import { SKILL_COLORS } from "@/lib/workflows/skill-colors";
import { cn } from "@/lib/utils";

const RAINBOW_GRADIENT =
  "conic-gradient(from 90deg, #f43f5e, #f97316, #eab308, #84cc16, #10b981, #06b6d4, #6366f1, #8b5cf6, #ec4899, #f43f5e)";

interface CompactEmojiPickerProps {
  value: string;
  /** When set, the trigger renders the colored ring used elsewhere so the
   *  emoji + color avatar reads identically across cards, pickers, and the
   *  editor header. */
  color?: string;
  onSelect: (emoji: string) => void;
  /** When provided, an inline swatch row appears inside the popover between
   *  the search input and the emoji grid — both pickers in one place. */
  onColorChange?: (color: string) => void;
  /** Whether the color row exposes the rainbow swatch that opens the OS
   *  color picker. Defaults to true; ignored if `onColorChange` is unset. */
  allowCustomColor?: boolean;
}

export function CompactEmojiPicker({
  value,
  color,
  onSelect,
  onColorChange,
  allowCustomColor = true,
}: CompactEmojiPickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const customColorRef = useRef<HTMLInputElement | null>(null);
  // One ref per category section so the bottom jump bar can scroll to it.
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const isCustomColor =
    typeof color === "string" &&
    color.startsWith("#") &&
    !SKILL_COLORS.includes(color as (typeof SKILL_COLORS)[number]);

  useEffect(() => {
    if (!open) return;

    inputRef.current?.focus();

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // On open, scroll so the currently selected emoji sits ~one row below
  // the sticky category header (i.e. visually in the second row). Clamped
  // to the category's top so we never scroll into the previous category
  // when the selection is in row 0. If `value` isn't in the catalog
  // (custom typed emoji), leave the panel at its natural top.
  useEffect(() => {
    if (!open) return;
    const scroller = scrollRef.current;
    if (!scroller) return;
    const button = scroller.querySelector<HTMLButtonElement>(
      `[data-emoji-value="true"]`,
    );
    if (!button) return;
    const headerHeight = 30;
    const rowHeight = button.clientHeight + 2;
    const desired = button.offsetTop - headerHeight - rowHeight;

    const category = EMOJI_CATEGORIES.find((cat) =>
      cat.emojis.some((entry) => entry.emoji === value),
    );
    const sectionTop = category
      ? sectionRefs.current[category.id]?.offsetTop ?? 0
      : 0;
    scroller.scrollTop = Math.max(sectionTop, desired);
  }, [open, value]);

  const normalizedQuery = query.trim().toLowerCase();
  const searchHits = useMemo<readonly EmojiEntry[]>(() => {
    if (normalizedQuery.length === 0) return [];
    return ALL_EMOJIS.filter((entry) =>
      [entry.emoji, entry.name].some((token) =>
        token.toLowerCase().includes(normalizedQuery),
      ),
    );
  }, [normalizedQuery]);

  const typedEmoji = query.trim();
  const hasTypedEmoji = /\p{Extended_Pictographic}/u.test(typedEmoji);

  function commitSelection(emoji: string) {
    onSelect(emoji);
    setOpen(false);
    setQuery("");
  }

  function jumpToCategory(categoryId: string) {
    const section = sectionRefs.current[categoryId];
    const scroller = scrollRef.current;
    if (!section || !scroller) return;
    scroller.scrollTo({ top: section.offsetTop, behavior: "smooth" });
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Change icon"
        onClick={() => setOpen((current) => !current)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-bg text-[16px] transition hover:bg-bg-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        style={
          color
            ? {
                border: `1.5px solid ${color}`,
                boxShadow: `0 0 0 2px ${color}1f`,
              }
            : undefined
        }
      >
        {value}
      </button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+10px)] z-30 w-[336px] overflow-hidden rounded-xl border border-border-hi bg-bg-2 shadow-[var(--shadow-canvas)]">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-t3" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search or type emoji"
                placeholder="Search or type emoji"
                className="w-full rounded-lg border border-border bg-bg px-9 py-2 text-[12.5px] text-t1 outline-none transition placeholder:text-t3 focus:border-primary"
              />
            </div>

            {hasTypedEmoji ? (
              <button
                type="button"
                onClick={() => commitSelection(typedEmoji.slice(0, 8))}
                className="mt-2 flex w-full items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-left text-[12.5px] text-t1 transition hover:bg-bg-3"
              >
                <span className="text-[16px]">{typedEmoji}</span>
                Use typed emoji
              </button>
            ) : null}

            {onColorChange ? (
              <div
                role="group"
                aria-label="Pick a color"
                className="mt-3 flex flex-wrap items-center gap-1.5"
              >
                {SKILL_COLORS.map((swatch) => {
                  const selected = swatch === color;
                  return (
                    <button
                      key={swatch}
                      type="button"
                      aria-label={`Use ${swatch}`}
                      aria-pressed={selected}
                      onClick={() => onColorChange(swatch)}
                      className="h-5 w-5 cursor-pointer rounded-full transition-transform hover:scale-110"
                      style={{
                        backgroundColor: swatch,
                        outline: selected ? `2px solid ${swatch}` : undefined,
                        outlineOffset: 2,
                      }}
                    />
                  );
                })}
                {allowCustomColor ? (
                  <>
                    <button
                      type="button"
                      aria-label="Pick a custom color"
                      aria-pressed={isCustomColor}
                      onClick={() => customColorRef.current?.click()}
                      className="relative h-5 w-5 cursor-pointer rounded-full transition-transform hover:scale-110"
                      style={{
                        background: RAINBOW_GRADIENT,
                        outline: isCustomColor && color ? `2px solid ${color}` : undefined,
                        outlineOffset: 2,
                      }}
                    >
                      {isCustomColor && color ? (
                        <span
                          aria-hidden
                          className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-white/70"
                          style={{ backgroundColor: color }}
                        />
                      ) : null}
                    </button>
                    {/* Hidden native picker — the rainbow slot opens the OS UI. */}
                    <input
                      ref={customColorRef}
                      type="color"
                      value={isCustomColor && color ? color : "#ffffff"}
                      onChange={(event) => onColorChange(event.target.value)}
                      className="pointer-events-none absolute h-0 w-0 opacity-0"
                      tabIndex={-1}
                      aria-hidden
                    />
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          <div ref={scrollRef} className="relative max-h-[300px] overflow-y-auto">
            {normalizedQuery.length > 0 ? (
              <div className="p-2">
                <div className="px-1 pb-1.5 pt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-t3">
                  {searchHits.length === 0
                    ? "No matches"
                    : `${searchHits.length} ${searchHits.length === 1 ? "match" : "matches"}`}
                </div>
                {searchHits.length > 0 ? (
                  <div className="grid grid-cols-8 gap-0.5">
                    {searchHits.map((entry) => (
                      <button
                        key={entry.emoji}
                        type="button"
                        aria-label={`Use ${entry.name}`}
                        title={entry.name}
                        onClick={() => commitSelection(entry.emoji)}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-[18px] transition hover:border-border hover:bg-bg-3",
                          entry.emoji === value ? "border-border bg-bg-3" : "bg-transparent",
                        )}
                      >
                        {entry.emoji}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              EMOJI_CATEGORIES.map((category) => (
                <div
                  key={category.id}
                  ref={(node) => {
                    sectionRefs.current[category.id] = node;
                  }}
                >
                  <div className="sticky top-0 z-10 border-b border-border bg-bg-2/95 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-t3 backdrop-blur">
                    {category.label}
                  </div>
                  <div className="grid grid-cols-8 gap-0.5 p-2">
                    {category.emojis.map((entry) => (
                      <button
                        key={entry.emoji}
                        type="button"
                        aria-label={`Use ${entry.name}`}
                        title={entry.name}
                        data-emoji-value={entry.emoji === value ? "true" : undefined}
                        onClick={() => commitSelection(entry.emoji)}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-[18px] transition hover:border-border hover:bg-bg-3",
                          entry.emoji === value ? "border-border bg-bg-3" : "bg-transparent",
                        )}
                      >
                        {entry.emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {normalizedQuery.length === 0 ? (
            <div
              role="tablist"
              aria-label="Emoji categories"
              className="flex items-center justify-between gap-0.5 border-t border-border bg-bg px-1 py-1"
            >
              {EMOJI_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  role="tab"
                  aria-label={`Jump to ${category.label}`}
                  title={category.label}
                  onClick={() => jumpToCategory(category.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[14px] text-t2 transition hover:bg-bg-3 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {category.icon}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

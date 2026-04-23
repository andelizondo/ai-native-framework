"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Download,
  Eye,
  Pencil,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  deleteFrameworkItemAction,
  upsertFrameworkItemAction,
} from "@/app/(dashboard)/framework/actions";
import { useDashboardTopBar } from "@/components/dashboard-topbar-context";
import { FrameworkHeaderActionsMenu } from "@/components/framework/framework-header-actions-menu";
import { FrameworkItemModal } from "@/components/framework/framework-item-modal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useAnalytics } from "@/lib/analytics/events";
import type { FrameworkItem, FrameworkItemType } from "@/lib/workflows/types";
import { cn } from "@/lib/utils";

interface FrameworkScreenProps {
  initialItems: FrameworkItem[];
  type: FrameworkItemType;
}

type EditorViewMode = "markdown" | "plain-text";

type FrameworkItemModalState =
  | null
  | {
      mode: "create" | "rename";
      initialName: string;
      initialDescription: string;
    };

const SKILL_EMOJIS = [
  { emoji: "🤖", label: "Robot", keywords: ["agent", "ai", "automation"] },
  { emoji: "🧠", label: "Brain", keywords: ["thinking", "reasoning", "strategy"] },
  { emoji: "✨", label: "Sparkles", keywords: ["polish", "quality", "magic"] },
  { emoji: "🛠️", label: "Tools", keywords: ["build", "developer", "implementation"] },
  { emoji: "🔍", label: "Search", keywords: ["audit", "review", "analysis"] },
  { emoji: "🧭", label: "Compass", keywords: ["navigation", "direction", "framework"] },
  { emoji: "✅", label: "Check", keywords: ["quality", "approval", "done"] },
  { emoji: "🗂️", label: "Folders", keywords: ["organization", "library", "catalog"] },
  { emoji: "📝", label: "Writing", keywords: ["documentation", "editor", "notes"] },
  { emoji: "🚀", label: "Rocket", keywords: ["launch", "ship", "release"] },
  { emoji: "🧪", label: "Experiment", keywords: ["test", "validation", "quality"] },
  { emoji: "🎯", label: "Target", keywords: ["goal", "focus", "scope"] },
] as const;

const PLAYBOOK_EMOJIS = [
  { emoji: "📄", label: "Document", keywords: ["procedure", "guide", "playbook"] },
  { emoji: "📚", label: "Books", keywords: ["knowledge", "library", "reference"] },
  { emoji: "🧪", label: "Experiment", keywords: ["test", "validation", "quality"] },
  { emoji: "🚀", label: "Rocket", keywords: ["launch", "ship", "release"] },
  { emoji: "🧱", label: "Brick", keywords: ["foundation", "system", "base"] },
  { emoji: "🗺️", label: "Map", keywords: ["plan", "navigation", "route"] },
  { emoji: "📌", label: "Pin", keywords: ["important", "reference", "anchor"] },
  { emoji: "🔐", label: "Lock", keywords: ["security", "policy", "governance"] },
  { emoji: "🧭", label: "Compass", keywords: ["direction", "operating model", "flow"] },
  { emoji: "📝", label: "Writing", keywords: ["instructions", "steps", "notes"] },
] as const;

function createFrameworkItemId(type: FrameworkItemType, name: string): string {
  const prefix = type === "skill" ? "sk" : "pb";
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${slug || "item"}-${crypto.randomUUID().slice(0, 8)}`;
  }

  return `${prefix}-${slug || "item"}-${Date.now().toString(36)}`;
}

function createDraftItem(type: FrameworkItemType, name: string, description: string): FrameworkItem {
  return {
    id: createFrameworkItemId(type, name),
    type,
    name: name.trim(),
    description: description.trim(),
    icon: type === "skill" ? "🤖" : "📄",
    content: `# ${name.trim()}\n\n`,
  };
}

function sortItems(nextItems: FrameworkItem[]) {
  return [...nextItems].sort((left, right) => left.name.localeCompare(right.name));
}

function areFrameworkItemsEqual(left: FrameworkItem | null, right: FrameworkItem | null) {
  if (!left || !right) return false;
  return (
    left.name === right.name &&
    left.description === right.description &&
    (left.icon ?? "") === (right.icon ?? "") &&
    left.content === right.content
  );
}

function CompactEmojiPicker({
  value,
  options,
  onSelect,
}: {
  value: string;
  options: readonly { emoji: string; label: string; keywords: readonly string[] }[];
  onSelect: (emoji: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

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

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions =
    normalizedQuery.length === 0
      ? options
      : options.filter((option) =>
          [option.emoji, option.label, ...option.keywords].some((token) =>
            token.toLowerCase().includes(normalizedQuery),
          ),
        );

  const typedEmoji = query.trim();
  const hasTypedEmoji = /\p{Extended_Pictographic}/u.test(typedEmoji);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Change icon"
        onClick={() => setOpen((current) => !current)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-bg text-[16px] transition hover:border-border-hi hover:bg-bg-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {value}
      </button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+10px)] z-30 w-[244px] rounded-xl border border-border-hi bg-bg-2 p-3 shadow-[var(--shadow-canvas)]">
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
              onClick={() => {
                onSelect(typedEmoji.slice(0, 8));
                setOpen(false);
                setQuery("");
              }}
              className="mt-2 flex w-full items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-left text-[12.5px] text-t1 transition hover:bg-bg-3"
            >
              <span className="text-[16px]">{typedEmoji}</span>
              Use typed emoji
            </button>
          ) : null}

          <div className="mt-2 grid max-h-[180px] grid-cols-5 gap-1 overflow-auto">
            {filteredOptions.map((option) => (
              <button
                key={option.emoji}
                type="button"
                aria-label={`Use ${option.label}`}
                title={option.label}
                onClick={() => {
                  onSelect(option.emoji);
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-[18px] transition hover:border-border hover:bg-bg-3",
                  option.emoji === value ? "border-border bg-bg-3" : "bg-transparent",
                )}
              >
                {option.emoji}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function FrameworkScreen({
  initialItems,
  type,
}: FrameworkScreenProps) {
  const { setConfig } = useDashboardTopBar();
  const { capture } = useAnalytics();
  const [items, setItems] = useState(initialItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftItem, setDraftItem] = useState<FrameworkItem | null>(null);
  const [lastSavedItem, setLastSavedItem] = useState<FrameworkItem | null>(null);
  const [editorView, setEditorView] = useState<EditorViewMode>("markdown");
  const [itemModalState, setItemModalState] = useState<FrameworkItemModalState>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const routeLabel = type === "skill" ? "Skills" : "Playbooks";
  const routeMetaLabel = type === "skill" ? "Framework library" : "Framework procedures";
  const routeDescription =
    type === "skill"
      ? "A compact library of reusable agent capabilities. Select a skill to read or edit its markdown source."
      : "A compact library of reusable execution procedures. Select a playbook to read or edit its markdown source.";
  const createLabel = type === "skill" ? "New skill" : "New playbook";
  const emojiOptions = type === "skill" ? SKILL_EMOJIS : PLAYBOOK_EMOJIS;
  const filteredItems = useMemo(
    () => items.filter((item) => item.type === type),
    [items, type],
  );
  const isDirty =
    draftItem !== null &&
    (lastSavedItem === null || !areFrameworkItemsEqual(draftItem, lastSavedItem));
  const deleteTarget =
    filteredItems.find((item) => item.id === confirmDeleteId) ??
    (draftItem?.id === confirmDeleteId ? draftItem : null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  function emitEditedEvent(itemId: string) {
    if (type === "skill") {
      capture("framework.skill_edited", {
        item_id: itemId,
        edited_by: "founder",
      });
    }
  }

  function beginEdit(item: FrameworkItem) {
    setError(null);
    setEditingId(item.id);
    setDraftItem(item);
    setLastSavedItem(item);
    setEditorView("markdown");
  }

  function resetEditor() {
    setEditingId(null);
    setDraftItem(null);
    setLastSavedItem(null);
    setEditorView("markdown");
  }

  function saveItem() {
    if (!draftItem) return;

    startTransition(async () => {
      try {
        const result = await upsertFrameworkItemAction({
          ...draftItem,
          name: draftItem.name.trim(),
          description: draftItem.description.trim(),
          icon: draftItem.icon?.trim() ?? null,
        });
        setItems((current) =>
          sortItems(
            current.map((item) => (item.id === result.item.id ? result.item : item)),
          ),
        );
        setDraftItem(result.item);
        setLastSavedItem(result.item);
        emitEditedEvent(result.item.id);
        setError(null);
      } catch (actionError) {
        setError(
          actionError instanceof Error && actionError.message
            ? actionError.message
            : `Could not save the ${type}.`,
        );
      }
    });
  }

  function deleteItem(itemId: string) {
    startTransition(async () => {
      try {
        await deleteFrameworkItemAction(itemId);
        setItems((current) => current.filter((item) => item.id !== itemId));
        setConfirmDeleteId(null);
        if (editingId === itemId) {
          resetEditor();
        }
        setError(null);
      } catch (actionError) {
        setError(
          actionError instanceof Error && actionError.message
            ? actionError.message
            : `Could not delete the ${type}.`,
        );
      }
    });
  }

  function downloadMarkdown() {
    if (!draftItem) return;

    const slug = draftItem.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const blob = new Blob([draftItem.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slug || "framework-item"}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    if (draftItem) {
      setConfig({
        mode: "page",
        crumbs: [
          {
            label: routeLabel,
            onClick: () => {
              resetEditor();
              setError(null);
            },
          },
          { label: draftItem.name },
        ],
        onSave: saveItem,
        saveDisabled:
          pending ||
          !isDirty ||
          !draftItem.name.trim() ||
          !draftItem.description.trim(),
        actions: (
          <FrameworkHeaderActionsMenu
            entityName={type === "skill" ? "skill" : "playbook"}
            onRename={() =>
              setItemModalState({
                mode: "rename",
                initialName: draftItem.name,
                initialDescription: draftItem.description,
              })
            }
            onDelete={() => setConfirmDeleteId(draftItem.id)}
          />
        ),
      });
      return () => setConfig(null);
    }

    setConfig({
      mode: "page",
      crumbs: [{ label: routeLabel }],
      actions: (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setItemModalState({
              mode: "create",
              initialName: "",
              initialDescription: "",
            });
          }}
          className="flex items-center gap-1.5 rounded-md border border-border bg-bg-2 px-2.5 py-1.5 text-[11.5px] font-medium text-t2 transition hover:border-border-hi hover:bg-bg-3 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Plus className="h-3.5 w-3.5" />
          {createLabel}
        </button>
      ),
    });

    return () => setConfig(null);
  }, [createLabel, draftItem, isDirty, pending, routeLabel, setConfig, type]);

  return (
    <div className="flex h-full flex-col overflow-hidden" data-testid={`framework-screen-${type}`}>
      <div className="shrink-0 border-b border-border bg-bg px-6 py-5">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-t3">
            {draftItem ? routeLabel.slice(0, -1) || routeLabel : routeMetaLabel}
          </p>

          {draftItem ? (
            <div className="mt-2 flex items-start gap-3">
              <CompactEmojiPicker
                value={draftItem.icon || emojiOptions[0]!.emoji}
                options={emojiOptions}
                onSelect={(emoji) =>
                  setDraftItem((current) => (current ? { ...current, icon: emoji } : current))
                }
              />
              <div className="min-w-0">
                <h1 className="truncate text-[22px] font-bold tracking-tight text-t1">
                  {draftItem.name}
                </h1>
                <p className="mt-1 max-w-3xl text-[13px] leading-6 text-t2">
                  {draftItem.description}
                </p>
              </div>
            </div>
          ) : (
            <>
              <h1 className="mt-1 truncate text-[20px] font-bold tracking-tight text-t1">
                {routeLabel}
              </h1>
              <p className="mt-1 text-[13px] text-t2">{routeDescription}</p>
            </>
          )}
        </div>
        {error ? (
          <div className="mt-2 text-[11.5px] text-(color:--pill-blocked-t)">{error}</div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden bg-bg-2">
        {draftItem ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-bg px-6 py-3">
              <div
                className="inline-flex w-fit items-center rounded-lg border border-border bg-bg-2 p-1"
                role="tablist"
                aria-label="Editor mode"
              >
                {(
                  [
                    ["markdown", "View", Eye],
                    ["plain-text", "Edit", Pencil],
                  ] as const
                ).map(([mode, label, Icon]) => (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={editorView === mode}
                    onClick={() => setEditorView(mode)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                      editorView === mode
                        ? "bg-bg text-t1"
                        : "text-t2 hover:bg-bg hover:text-t1",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={downloadMarkdown}
                className="flex items-center gap-1.5 rounded-md border border-border bg-bg px-3 py-2 text-[12px] font-medium text-t2 transition hover:bg-bg-3 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden px-6 py-6">
              <div className="mx-auto flex h-full min-h-0 w-full max-w-[1120px] flex-col">
                <div
                  className={cn(
                    "h-full min-h-0 overflow-auto transition-colors",
                    editorView === "markdown"
                      ? "bg-bg"
                      : "rounded-[16px] bg-bg-3/65 ring-1 ring-border",
                  )}
                >
                  {editorView === "markdown" ? (
                    <div
                      data-testid={`framework-markdown-preview-${type}`}
                      className="min-h-full px-8 py-7"
                    >
                      <div className="max-w-3xl">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({ node: _node, ...props }) => (
                              <h1 className="mb-4 text-[28px] font-bold tracking-tight text-t1" {...props} />
                            ),
                            h2: ({ node: _node, ...props }) => (
                              <h2 className="mb-3 mt-8 text-[22px] font-semibold tracking-tight text-t1" {...props} />
                            ),
                            h3: ({ node: _node, ...props }) => (
                              <h3 className="mb-2 mt-6 text-[17px] font-semibold text-t1" {...props} />
                            ),
                            p: ({ node: _node, ...props }) => (
                              <p className="mb-4 text-[14px] leading-7 text-t1" {...props} />
                            ),
                            ul: ({ node: _node, ...props }) => (
                              <ul className="mb-4 list-disc space-y-2 pl-6" {...props} />
                            ),
                            ol: ({ node: _node, ...props }) => (
                              <ol className="mb-4 list-decimal space-y-2 pl-6" {...props} />
                            ),
                            li: ({ node: _node, ...props }) => (
                              <li className="text-[14px] leading-7 text-t1" {...props} />
                            ),
                            blockquote: ({ node: _node, ...props }) => (
                              <blockquote className="mb-4 border-l-2 border-border-hi pl-4 italic text-t2" {...props} />
                            ),
                            code: ({ node: _node, className, ...props }) => (
                              <code
                                className={cn(
                                  "rounded bg-bg-2 px-1.5 py-0.5 font-mono text-[12px] text-t1",
                                  className,
                                )}
                                {...props}
                              />
                            ),
                            pre: ({ node: _node, ...props }) => (
                              <pre className="mb-4 overflow-x-auto rounded-xl border border-border bg-bg-2 p-4 font-mono text-[12px] text-t1" {...props} />
                            ),
                            a: ({ node: _node, ...props }) => (
                              <a className="text-accent underline underline-offset-2" {...props} />
                            ),
                          }}
                        >
                          {draftItem.content || "_No content yet._"}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ) : (
                    <div className="min-h-full px-5 py-5">
                      <textarea
                        value={draftItem.content}
                        onChange={(event) =>
                          setDraftItem((current) =>
                            current ? { ...current, content: event.target.value } : current,
                          )
                        }
                        spellCheck={false}
                        data-testid={`framework-editor-${type}`}
                        className="block min-h-full w-full resize-none rounded-[12px] bg-bg px-6 py-6 font-mono text-[13px] leading-7 text-t1 outline-none transition placeholder:text-t3"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col p-6">
            <div className="min-h-0 flex-1 overflow-auto px-1 py-2">
              <div
                className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]"
                data-testid={`framework-grid-${type}`}
              >
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => beginEdit(item)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        beginEdit(item);
                      }
                    }}
                    data-testid={`framework-card-${item.id}`}
                    className="group flex h-[104px] cursor-pointer items-center gap-3 overflow-hidden rounded-[10px] border border-border bg-bg px-4 py-4 text-left transition-all duration-150 hover:border-border-hi hover:bg-bg-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-bg-2 text-[18px]"
                      aria-hidden
                    >
                      {item.icon || (type === "skill" ? "🤖" : "📄")}
                    </span>
                    <span className="min-w-0 flex-1 overflow-hidden">
                      <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-t1">
                        {item.name}
                      </span>
                      <span className="mt-1 block overflow-hidden text-[11.5px] leading-[1.35] text-t2 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                        {item.description}
                      </span>
                    </span>
                  </div>
                ))}

                {filteredItems.length === 0 ? (
                  <div className="col-span-full flex min-h-[180px] flex-col items-center justify-center rounded-[14px] border border-dashed border-border-hi bg-bg px-6 text-center">
                    <Sparkles className="mb-3 h-5 w-5 text-t3" />
                    <p className="text-[13px] font-medium text-t1">
                      No {type === "skill" ? "skills" : "playbooks"} yet
                    </p>
                    <p className="mt-1 max-w-sm text-[11.5px] leading-5 text-t3">
                      Create the first {type === "skill" ? "skill" : "playbook"} to populate this library.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>

      {itemModalState ? (
        <FrameworkItemModal
          title={
            itemModalState.mode === "create"
              ? `Create ${type === "skill" ? "skill" : "playbook"}`
              : `Rename ${type === "skill" ? "skill" : "playbook"}`
          }
          description={
            itemModalState.mode === "create"
              ? `Add the ${type === "skill" ? "skill" : "playbook"} title and description first.`
              : `Update the ${type === "skill" ? "skill" : "playbook"} title and description.`
          }
          initialName={itemModalState.initialName}
          initialDescription={itemModalState.initialDescription}
          submitLabel={itemModalState.mode === "create" ? "Create" : "Apply"}
          pending={pending}
          onClose={() => {
            if (!pending) {
              setItemModalState(null);
            }
          }}
          onSubmit={({ name, description }) => {
            if (itemModalState.mode === "rename") {
              setDraftItem((current) =>
                current
                  ? {
                      ...current,
                      name: name.trim(),
                      description: description.trim(),
                    }
                  : current,
              );
              setItemModalState(null);
              return;
            }

            const draft = createDraftItem(type, name, description);
            startTransition(async () => {
              try {
                const result = await upsertFrameworkItemAction(draft);
                setItems((current) =>
                  sortItems([
                    ...current.filter((item) => item.id !== result.item.id),
                    result.item,
                  ]),
                );
                setItemModalState(null);
                setEditingId(result.item.id);
                setDraftItem(result.item);
                setLastSavedItem(result.item);
                setEditorView("markdown");
                emitEditedEvent(result.item.id);
                setError(null);
              } catch (actionError) {
                setError(
                  actionError instanceof Error && actionError.message
                    ? actionError.message
                    : `Could not create the ${type}.`,
                );
              }
            });
          }}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmModal
          title={`Delete "${deleteTarget.name}"?`}
          description={`This will permanently remove this ${type}. This cannot be undone.`}
          onConfirm={() => deleteItem(deleteTarget.id)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      ) : null}
    </div>
  );
}

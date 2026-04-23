"use client";

import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Download,
  Eye,
  Link2,
  List,
  ListOrdered,
  Pencil,
  Plus,
  Search,
  Sparkles,
  X,
  TextQuote,
  Upload,
  WrapText,
  Italic,
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

type EditorSelection = {
  start: number;
  end: number;
};

type EditorViewport = {
  scrollTop: number;
  scrollLeft: number;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const editorTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const pendingSelectionRef = useRef<EditorSelection | null>(null);
  const pendingViewportRef = useRef<EditorViewport | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const routeLabel = type === "skill" ? "Skills" : "Playbooks";
  const routeMetaLabel = type === "skill" ? "Framework library" : "Framework procedures";
  const routeDescription =
    type === "skill"
      ? "A compact library of reusable agent capabilities. Select a skill to read or edit its markdown source."
      : "A compact library of reusable execution procedures. Select a playbook to read or edit its markdown source.";
  const createLabel = type === "skill" ? "New skill" : "New playbook";
  const emojiOptions = type === "skill" ? SKILL_EMOJIS : PLAYBOOK_EMOJIS;
  const typedItems = useMemo(
    () => items.filter((item) => item.type === type),
    [items, type],
  );
  const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (normalizedSearchQuery.length === 0) {
      return typedItems;
    }

    return typedItems.filter((item) =>
      [item.name, item.description, item.content, item.id]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearchQuery)),
    );
  }, [normalizedSearchQuery, typedItems]);
  const visibleItems = useMemo(
    () => [...filteredItems].sort((left, right) => left.name.localeCompare(right.name)),
    [filteredItems],
  );
  const isDirty =
    draftItem !== null &&
    (lastSavedItem === null || !areFrameworkItemsEqual(draftItem, lastSavedItem));
  const deleteTarget =
    typedItems.find((item) => item.id === confirmDeleteId) ??
    (draftItem?.id === confirmDeleteId ? draftItem : null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  useLayoutEffect(() => {
    if (editorView !== "plain-text") {
      return;
    }

    const nextSelection = pendingSelectionRef.current;
    const nextViewport = pendingViewportRef.current;
    pendingSelectionRef.current = null;
    pendingViewportRef.current = null;

    if (!editorTextareaRef.current) return;

    if (nextSelection) {
      editorTextareaRef.current.focus();
      editorTextareaRef.current.setSelectionRange(nextSelection.start, nextSelection.end);
    }

    if (nextViewport) {
      editorTextareaRef.current.scrollTop = nextViewport.scrollTop;
      editorTextareaRef.current.scrollLeft = nextViewport.scrollLeft;
    }
  }, [draftItem?.content, editorView]);

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

  function updateDraftContent(
    nextContent: string,
    options?: {
      selection?: EditorSelection;
      viewport?: EditorViewport;
    },
  ) {
    setDraftItem((current) => (current ? { ...current, content: nextContent } : current));
    pendingSelectionRef.current = options?.selection ?? null;
    pendingViewportRef.current = options?.viewport ?? null;
  }

  function withEditorSelection(
    transform: (context: {
      content: string;
      selectionStart: number;
      selectionEnd: number;
    }) => { content: string; selection: EditorSelection },
  ) {
    const textarea = editorTextareaRef.current;
    if (!draftItem || !textarea) return;

    const result = transform({
      content: draftItem.content,
      selectionStart: textarea.selectionStart ?? 0,
      selectionEnd: textarea.selectionEnd ?? 0,
    });

    updateDraftContent(result.content, {
      selection: result.selection,
      viewport: {
        scrollTop: textarea.scrollTop,
        scrollLeft: textarea.scrollLeft,
      },
    });
  }

  function toggleInlineWrap(token: string, placeholder: string) {
    withEditorSelection(({ content, selectionStart, selectionEnd }) => {
      const selectedText = content.slice(selectionStart, selectionEnd);
      const hasSelection = selectionStart !== selectionEnd;
      const wrappedSelection =
        selectionStart >= token.length &&
        content.slice(selectionStart - token.length, selectionStart) === token &&
        content.slice(selectionEnd, selectionEnd + token.length) === token;

      if (wrappedSelection) {
        const nextContent =
          content.slice(0, selectionStart - token.length) +
          selectedText +
          content.slice(selectionEnd + token.length);
        return {
          content: nextContent,
          selection: {
            start: selectionStart - token.length,
            end: selectionEnd - token.length,
          },
        };
      }

      const insertedText = hasSelection ? selectedText : placeholder;
      const nextContent =
        content.slice(0, selectionStart) +
        token +
        insertedText +
        token +
        content.slice(selectionEnd);

      return {
        content: nextContent,
        selection: {
          start: selectionStart + token.length,
          end: selectionStart + token.length + insertedText.length,
        },
      };
    });
  }

  function toggleLinePrefix(prefix: string, placeholder: string) {
    withEditorSelection(({ content, selectionStart, selectionEnd }) => {
      const lineStart = content.lastIndexOf("\n", Math.max(selectionStart - 1, 0)) + 1;
      let lineEnd = content.indexOf("\n", selectionEnd);
      if (lineEnd === -1) lineEnd = content.length;

      const block = content.slice(lineStart, lineEnd);
      const lines = block.length > 0 ? block.split("\n") : [""];
      const shouldRemove = lines.every((line) => line.startsWith(prefix));
      const normalizedLines = shouldRemove
        ? lines.map((line) => line.slice(prefix.length))
        : lines.map((line) => (line.length > 0 ? `${prefix}${line}` : `${prefix}${placeholder}`));
      const nextBlock = normalizedLines.join("\n");
      const nextContent = content.slice(0, lineStart) + nextBlock + content.slice(lineEnd);

      return {
        content: nextContent,
        selection: {
          start: lineStart,
          end: lineStart + nextBlock.length,
        },
      };
    });
  }

  function insertLink() {
    withEditorSelection(({ content, selectionStart, selectionEnd }) => {
      const selectedText = content.slice(selectionStart, selectionEnd) || "link text";
      const linkText = `[${selectedText}](https://example.com)`;
      const nextContent =
        content.slice(0, selectionStart) + linkText + content.slice(selectionEnd);

      return {
        content: nextContent,
        selection: {
          start: selectionStart + 1,
          end: selectionStart + 1 + selectedText.length,
        },
      };
    });
  }

  function insertCodeBlock() {
    withEditorSelection(({ content, selectionStart, selectionEnd }) => {
      const selectedText = content.slice(selectionStart, selectionEnd).trim() || "code";
      const prefix = selectionStart > 0 && content[selectionStart - 1] !== "\n" ? "\n" : "";
      const suffix = selectionEnd < content.length && content[selectionEnd] !== "\n" ? "\n" : "";
      const block = `${prefix}\`\`\`\n${selectedText}\n\`\`\`${suffix}`;
      const nextContent =
        content.slice(0, selectionStart) + block + content.slice(selectionEnd);
      const codeStart = selectionStart + prefix.length + 4;

      return {
        content: nextContent,
        selection: {
          start: codeStart,
          end: codeStart + selectedText.length,
        },
      };
    });
  }

  const toolbarItems = [
    {
      label: "Heading",
      icon: Heading1,
      onClick: () => toggleLinePrefix("# ", "Heading"),
    },
    {
      label: "Subheading",
      icon: Heading2,
      onClick: () => toggleLinePrefix("## ", "Subheading"),
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      onClick: () => toggleLinePrefix("1. ", "List item"),
    },
    {
      label: "Bulleted list",
      icon: List,
      onClick: () => toggleLinePrefix("- ", "List item"),
    },
    {
      label: "Bold",
      icon: Bold,
      onClick: () => toggleInlineWrap("**", "bold text"),
    },
    {
      label: "Italic",
      icon: Italic,
      onClick: () => toggleInlineWrap("*", "italic text"),
    },
    {
      label: "Link",
      icon: Link2,
      onClick: insertLink,
    },
    {
      label: "Quote",
      icon: TextQuote,
      onClick: () => toggleLinePrefix("> ", "Quoted text"),
    },
    {
      label: "Inline code",
      icon: Code,
      onClick: () => toggleInlineWrap("`", "code"),
    },
    {
      label: "Code block",
      icon: WrapText,
      onClick: insertCodeBlock,
    },
  ] as const;

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

  function readMarkdownFile(file: File): Promise<string> {
    if (typeof file.text === "function") {
      return file.text();
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.readAsText(file);
    });
  }

  async function importMarkdownFile(file: File) {
    if (!file) return;

    try {
      const nextContent = await readMarkdownFile(file);
      updateDraftContent(nextContent);
      setError(null);
      setEditorView("plain-text");
    } catch {
      setError("Could not read the markdown file.");
    }
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
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden"
      data-testid={`framework-screen-${type}`}
    >
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

      <div className="flex min-h-0 flex-1 overflow-hidden bg-bg-2">
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

              <div className="flex items-center gap-2">
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".md,text/markdown"
                  className="sr-only"
                  aria-label="Upload markdown file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void importMarkdownFile(file);
                    }
                    event.currentTarget.value = "";
                  }}
                />

                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-bg px-3 py-2 text-[12px] font-medium text-t2 transition hover:bg-bg-3 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload
                </button>

                <button
                  type="button"
                  onClick={downloadMarkdown}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-bg px-3 py-2 text-[12px] font-medium text-t2 transition hover:bg-bg-3 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden px-6 py-6">
              <div className="mx-auto flex h-full min-h-0 w-full max-w-[1180px] flex-col">
                <div
                  className={cn(
                    "relative h-full min-h-0 overflow-hidden rounded-[22px] border transition-[border-color,box-shadow,background-color]",
                    editorView === "markdown"
                      ? "border-border bg-linear-to-b from-bg to-bg-2/92 shadow-[0_24px_80px_rgba(15,23,42,0.08)]"
                      : "border-border-hi bg-linear-to-b from-bg to-bg-3/90 shadow-[0_28px_90px_rgba(15,23,42,0.12)]",
                  )}
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-linear-to-b from-white/6 to-transparent opacity-70" />
                  {editorView === "markdown" ? (
                    <div className="h-full min-h-0 overflow-auto">
                      <div
                        data-testid={`framework-markdown-preview-${type}`}
                        className="mx-auto min-h-full w-full max-w-[920px] px-6 py-7 md:px-8 md:py-9"
                      >
                        <div className="max-w-[70ch]">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({ node: _node, ...props }) => (
                              <h1
                                className="mb-5 text-[30px] font-bold tracking-[-0.03em] text-t1"
                                {...props}
                              />
                            ),
                            h2: ({ node: _node, ...props }) => (
                              <h2
                                className="mb-3 mt-10 border-t border-border pt-6 text-[22px] font-semibold tracking-[-0.02em] text-t1 first:mt-0 first:border-t-0 first:pt-0"
                                {...props}
                              />
                            ),
                            h3: ({ node: _node, ...props }) => (
                              <h3 className="mb-2 mt-7 text-[17px] font-semibold text-t1" {...props} />
                            ),
                            p: ({ node: _node, ...props }) => (
                              <p className="mb-4 text-[14px] leading-7 text-t1/95" {...props} />
                            ),
                            ul: ({ node: _node, ...props }) => (
                              <ul className="mb-5 list-disc space-y-2.5 pl-6 marker:text-t3" {...props} />
                            ),
                            ol: ({ node: _node, ...props }) => (
                              <ol className="mb-5 list-decimal space-y-2.5 pl-6 marker:text-t3" {...props} />
                            ),
                            li: ({ node: _node, ...props }) => (
                              <li className="text-[14px] leading-7 text-t1" {...props} />
                            ),
                            blockquote: ({ node: _node, ...props }) => (
                              <blockquote
                                className="mb-5 rounded-r-[14px] border-l-[3px] border-border-hi bg-bg-2/65 px-4 py-3 italic text-t2"
                                {...props}
                              />
                            ),
                            code: ({ node: _node, className, ...props }) => (
                              <code
                                className={cn(
                                  "rounded-md bg-bg-2 px-1.5 py-0.5 font-mono text-[12px] text-t1",
                                  className,
                                )}
                                {...props}
                              />
                            ),
                            pre: ({ node: _node, ...props }) => (
                              <pre
                                className="mb-5 overflow-x-auto rounded-[16px] border border-border bg-bg-2 p-4 font-mono text-[12px] text-t1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                                {...props}
                              />
                            ),
                            a: ({ node: _node, ...props }) => (
                              <a
                                className="text-accent underline decoration-accent/35 underline-offset-3 transition hover:decoration-accent"
                                {...props}
                              />
                            ),
                          }}
                        >
                          {draftItem.content || "_No content yet._"}
                        </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full min-h-0 overflow-hidden">
                      <div className="flex h-full min-h-0 w-full flex-col">
                        <div className="flex items-center justify-between gap-3 border-b border-border-hi bg-bg-2 px-5 py-4 md:px-6">
                          <div className="min-w-0 flex-1">
                            <div
                              className="flex flex-wrap items-center gap-1.5"
                              role="toolbar"
                              aria-label="Markdown formatting"
                            >
                              {toolbarItems.map(({ label, icon: Icon, onClick }) => (
                                <button
                                  key={label}
                                  type="button"
                                  aria-label={label}
                                  title={label}
                                  onClick={onClick}
                                  className="flex h-8 w-8 items-center justify-center rounded-md bg-bg-3 text-t2 transition hover:bg-bg-4 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                >
                                  <Icon className="h-3.5 w-3.5" />
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="min-w-0 text-right">
                            <p className="truncate font-mono text-[11px] uppercase tracking-[0.16em] text-t2">
                              Markdown editor
                            </p>
                          </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-auto bg-linear-to-b from-bg-2 to-bg-3">
                          <div className="flex min-h-full">
                            <div
                              className="hidden w-14 shrink-0 select-none border-r border-border bg-bg px-2 py-5 text-right font-mono text-[11px] leading-7 text-t3 md:block"
                              aria-hidden
                            >
                              {Array.from(
                                {
                                  length: Math.max(
                                    (draftItem.content.match(/\n/g)?.length ?? 0) + 1,
                                    16,
                                  ),
                                },
                                (_, index) => (
                                  <div key={index}>{index + 1}</div>
                                ),
                              )}
                            </div>

                            <textarea
                              ref={editorTextareaRef}
                              value={draftItem.content}
                              onChange={(event) =>
                                updateDraftContent(event.target.value, {
                                  viewport: {
                                    scrollTop: event.target.scrollTop,
                                    scrollLeft: event.target.scrollLeft,
                                  },
                                })
                              }
                              spellCheck={false}
                              data-testid={`framework-editor-${type}`}
                              className="block min-h-full w-full resize-none bg-transparent px-5 py-5 font-mono text-[13px] leading-7 text-t1 outline-none transition placeholder:text-t3 md:px-6"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden px-6 py-6">
            <div className="mx-auto flex h-full min-h-0 w-full max-w-[1180px] flex-col">
              <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] border border-border bg-linear-to-b from-bg to-bg-2/92 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <div className="sticky top-0 z-10 border-b border-border bg-linear-to-b from-bg via-bg to-bg-2/96 px-3 py-5 backdrop-blur-sm md:px-4">
                    <div className="flex flex-wrap items-end justify-between gap-4 md:flex-nowrap">
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-t3">
                          {typedItems.length} {type === "skill" ? "skills" : "playbooks"}
                        </p>
                        <p className="mt-2 text-[15px] font-semibold tracking-[-0.01em] text-t1">
                          {normalizedSearchQuery.length > 0
                            ? `${filteredItems.length} matching ${
                                filteredItems.length === 1
                                  ? type === "skill"
                                    ? "skill"
                                    : "playbook"
                                  : type === "skill"
                                    ? "skills"
                                    : "playbooks"
                              }`
                            : type === "skill"
                              ? "Skill Library"
                              : "Playbook Library"}
                        </p>
                      </div>

                      <div className="flex w-full justify-start md:ml-auto md:w-auto md:justify-end">
                        <div
                          className={cn(
                            "flex items-center overflow-hidden rounded-xl border border-border bg-bg-2 transition-[width,border-color,background-color,box-shadow] duration-200",
                            searchOpen || searchQuery.length > 0
                              ? "w-full max-w-[360px] border-border-hi bg-bg-3 shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
                              : "w-12",
                          )}
                        >
                          <button
                            type="button"
                            aria-label={`Search ${type === "skill" ? "skills" : "playbooks"}`}
                            onClick={() => setSearchOpen(true)}
                            className="flex h-12 w-12 shrink-0 items-center justify-center text-t3 transition hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                          >
                            <Search className="h-4 w-4" />
                          </button>
                          <input
                            ref={searchInputRef}
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            onFocus={() => setSearchOpen(true)}
                            onBlur={() => {
                              if (searchQuery.trim().length === 0) {
                                setSearchOpen(false);
                              }
                            }}
                            placeholder={`Search ${type === "skill" ? "skills" : "playbooks"}`}
                            className={cn(
                              "min-w-0 bg-transparent pr-4 text-[13px] text-t1 outline-none placeholder:text-t3 transition-[opacity,width,padding] duration-200",
                              searchOpen || searchQuery.length > 0
                                ? "w-[min(308px,calc(100vw-10rem))] px-0 opacity-100"
                                : "w-0 px-0 opacity-0",
                            )}
                          />
                          {searchQuery.length > 0 ? (
                            <button
                              type="button"
                              aria-label="Clear search"
                              onClick={() => {
                                setSearchQuery("");
                                searchInputRef.current?.focus();
                              }}
                              className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-t3 transition hover:bg-bg hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 md:p-4">
                  {visibleItems.length > 0 ? (
                    <div
                      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
                      data-testid={`framework-grid-${type}`}
                    >
                      {visibleItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => beginEdit(item)}
                          data-testid={`framework-card-${item.id}`}
                          className="group flex min-h-[168px] flex-col justify-between rounded-[18px] border border-border bg-bg-2/88 px-5 py-5 text-left transition-[background-color,border-color,transform,box-shadow] duration-150 hover:border-border-hi hover:bg-bg-3/92 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)] focus-visible:-translate-y-[1px] focus-visible:border-border-hi focus-visible:bg-bg-3/92 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <h2 className="overflow-hidden text-[18px] leading-[1.15] font-semibold tracking-[-0.02em] text-t1 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                                {item.name}
                              </h2>
                            </div>
                            <span
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-bg text-[18px] text-t1 transition-colors group-hover:border-border-hi group-hover:bg-bg-2"
                              aria-hidden
                            >
                              {item.icon || (type === "skill" ? "🤖" : "📄")}
                            </span>
                          </div>

                          <div className="mt-5 min-w-0">
                            <p className="overflow-hidden text-[13px] leading-6 text-t2 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">
                              {item.description}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div
                      className="flex min-h-full min-w-0 items-center justify-center rounded-[18px] border border-dashed border-border-hi bg-bg-2/72 px-6 py-10 text-center"
                      data-testid={`framework-grid-${type}`}
                    >
                      <div className="max-w-md">
                        <Sparkles className="mx-auto h-5 w-5 text-t3" />
                        <p className="mt-4 text-[15px] font-semibold tracking-[-0.01em] text-t1">
                          {typedItems.length === 0
                            ? `No ${type === "skill" ? "skills" : "playbooks"} yet`
                            : `No ${type === "skill" ? "skills" : "playbooks"} match that search`}
                        </p>
                        <p className="mt-2 text-[12.5px] leading-6 text-t2">
                          {typedItems.length === 0
                            ? `Create the first ${type === "skill" ? "skill" : "playbook"} to start building this library.`
                            : `Try a different title or keyword to keep scanning the library.`}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                </div>
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

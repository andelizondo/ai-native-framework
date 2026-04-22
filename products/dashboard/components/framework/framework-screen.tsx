"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Download, Plus, Sparkles, X } from "lucide-react";

import {
  deleteFrameworkItemAction,
  upsertFrameworkItemAction,
} from "@/app/(dashboard)/framework/actions";
import { useDashboardTopBar } from "@/components/dashboard-topbar-context";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useAnalytics } from "@/lib/analytics/events";
import type { FrameworkItem, FrameworkItemType } from "@/lib/workflows/types";
import { cn } from "@/lib/utils";

interface FrameworkScreenProps {
  initialItems: FrameworkItem[];
  type: FrameworkItemType;
}

const SKILL_EMOJIS = ["🤖", "🧠", "✨", "🛠️", "🔍", "🧭", "✅", "🗂️"];
const PLAYBOOK_EMOJIS = ["📄", "📚", "🧪", "🚀", "🧱", "🗺️", "📌", "🔐"];

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

function EmojiPicker({
  value,
  options,
  onSelect,
}: {
  value: string;
  options: string[];
  onSelect: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Emoji picker"
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-bg text-[18px] transition hover:border-border-hi hover:bg-bg-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {value}
      </button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-20 grid grid-cols-4 gap-1 rounded-xl border border-border bg-bg-2 p-2 shadow-[var(--shadow-canvas)]">
          {options.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onSelect(emoji);
                setOpen(false);
              }}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg text-[18px] transition hover:bg-bg-3",
                emoji === value ? "bg-bg-3" : "bg-transparent",
              )}
            >
              {emoji}
            </button>
          ))}
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
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const routeLabel = type === "skill" ? "Skills" : "Playbooks";
  const routeMetaLabel = type === "skill" ? "Framework library" : "Framework procedures";
  const routeDescription =
    type === "skill"
      ? "A compact library of reusable agent capabilities. Select a skill to edit its markdown source."
      : "A compact library of reusable execution procedures. Select a playbook to edit its markdown source.";
  const createLabel = type === "skill" ? "New skill" : "New playbook";
  const emojiOptions = type === "skill" ? SKILL_EMOJIS : PLAYBOOK_EMOJIS;

  const filteredItems = useMemo(
    () => items.filter((item) => item.type === type),
    [items, type],
  );
  const editingItem = filteredItems.find((item) => item.id === editingId) ?? null;
  const deleteTarget = filteredItems.find((item) => item.id === confirmDeleteId) ?? null;

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    setConfig({
      mode: "page",
      crumbs: editingItem
        ? [
            {
              label: routeLabel,
              onClick: () => {
                setEditingId(null);
                setError(null);
              },
            },
            { label: editingItem.name },
          ]
        : [{ label: routeLabel }],
      actions:
        editingItem || adding ? null : (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setAdding(true);
            }}
            className="flex items-center gap-1.5 rounded-md border border-border bg-bg-2 px-2.5 py-1.5 text-[11.5px] font-medium text-t2 transition hover:border-border-hi hover:bg-bg-3 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Plus className="h-3.5 w-3.5" />
            {createLabel}
          </button>
        ),
    });

    return () => setConfig(null);
  }, [adding, createLabel, editingItem, routeLabel, setConfig]);

  function resetAddForm() {
    setAdding(false);
    setName("");
    setDescription("");
  }

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
    setAdding(false);
    setEditingId(item.id);
    setEditContent(item.content);
    setEditName(item.name);
    setEditDescription(item.description);
    setEditIcon(item.icon ?? emojiOptions[0]!);
  }

  function createItem() {
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
        resetAddForm();
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
  }

  function saveItem() {
    if (!editingItem) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await upsertFrameworkItemAction({
          ...editingItem,
          name: editName.trim(),
          description: editDescription.trim(),
          icon: editIcon.trim(),
          content: editContent,
        });
        setItems((current) =>
          sortItems(
            current.map((item) => (item.id === result.item.id ? result.item : item)),
          ),
        );
        setEditingId(null);
        setEditContent("");
        setEditName("");
        setEditDescription("");
        setEditIcon("");
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
          setEditingId(null);
          setEditContent("");
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
    if (!editingItem) return;

    const slug = (editName || editingItem.name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const blob = new Blob([editContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slug || "framework-item"}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden" data-testid={`framework-screen-${type}`}>
      <div className="shrink-0 border-b border-border bg-bg px-6 py-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-t3">
            {editingItem ? routeLabel.slice(0, -1) || routeLabel : routeMetaLabel}
          </p>
          <h1 className="mt-1 truncate text-[20px] font-bold tracking-tight text-t1">
            {editingItem ? editName || editingItem.name : routeLabel}
          </h1>
          <p className="mt-1 text-[13px] text-t2">
            {editingItem
              ? editDescription || editingItem.description
              : routeDescription}
          </p>
        </div>
        {error ? (
          <div className="mt-2 text-[11.5px] text-(color:--pill-blocked-t)">{error}</div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden bg-bg-2 p-6">
        {editingItem ? (
          <div className="flex h-full min-h-0 flex-col rounded-[16px] border border-border bg-bg-2">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <EmojiPicker
                  value={editIcon || emojiOptions[0]!}
                  options={emojiOptions}
                  onSelect={setEditIcon}
                />
                <div className="min-w-0">
                  <input
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    aria-label="Name"
                    className="w-full min-w-0 bg-transparent text-[14px] font-semibold text-t1 outline-none placeholder:text-t3"
                    placeholder={`${routeLabel.slice(0, -1)} name`}
                  />
                  <input
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    aria-label="Description"
                    className="mt-1 w-full min-w-0 bg-transparent text-[12px] text-t2 outline-none placeholder:text-t3"
                    placeholder="Short description"
                  />
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={downloadMarkdown}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-bg px-3 py-2 text-[12px] font-medium text-t2 transition hover:bg-bg-3 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={saveItem}
                  disabled={pending || !editName.trim() || !editDescription.trim()}
                  className={cn(
                    "rounded-md px-3 py-2 text-[12px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    pending || !editName.trim() || !editDescription.trim()
                      ? "cursor-not-allowed bg-primary text-white opacity-70"
                      : "bg-primary text-white hover:opacity-90",
                  )}
                >
                  Save
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 p-5">
              <textarea
                value={editContent}
                onChange={(event) => setEditContent(event.target.value)}
                spellCheck={false}
                data-testid={`framework-editor-${type}`}
                className="h-full min-h-[320px] w-full resize-none rounded-xl border border-border bg-bg px-4 py-3 font-mono text-[12.5px] leading-6 text-t1 outline-none transition placeholder:text-t3 focus:border-primary"
              />
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            {adding ? (
              <div
                className="mb-5 shrink-0 rounded-[14px] border border-border bg-bg px-5 py-4"
                data-testid={`framework-add-form-${type}`}
              >
                <div className="grid gap-3 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] md:items-end">
                  <div className="min-w-0">
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.13em] text-t3">
                      Name
                    </label>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder={type === "skill" ? "Skill name" : "Playbook name"}
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-[12.5px] text-t1 outline-none transition placeholder:text-t3 focus:border-primary"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.13em] text-t3">
                      Description
                    </label>
                    <input
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Short description"
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-[12.5px] text-t1 outline-none transition placeholder:text-t3 focus:border-primary"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={createItem}
                      disabled={pending || !name.trim() || !description.trim()}
                      className={cn(
                        "rounded-md px-3 py-2 text-[12px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                        pending || !name.trim() || !description.trim()
                          ? "cursor-not-allowed bg-primary text-white opacity-70"
                          : "bg-primary text-white hover:opacity-90",
                      )}
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        resetAddForm();
                        setError(null);
                      }}
                      disabled={pending}
                      className="rounded-md border border-border bg-bg px-3 py-2 text-[12px] font-medium text-t2 transition hover:bg-bg-3 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

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
                    className="group relative flex h-[104px] cursor-pointer items-center gap-3 overflow-hidden rounded-[7px] border border-border bg-bg-2 px-4 py-4 text-left transition-all duration-150 hover:border-border-hi hover:bg-bg-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[7px] border border-border bg-bg text-[18px]"
                      aria-hidden
                    >
                      {item.icon || (type === "skill" ? "🤖" : "📄")}
                    </span>
                    <span className="min-w-0 flex-1 overflow-hidden pr-8">
                      <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-t1">
                        {item.name}
                      </span>
                      <span className="mt-1 block overflow-hidden text-[11.5px] leading-[1.35] text-t2 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                        {item.description}
                      </span>
                    </span>
                    <span className="absolute right-3 top-3 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[8px] border border-border bg-bg-3 text-t3 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        title={`Delete ${item.name}`}
                        aria-label={`Delete ${item.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setConfirmDeleteId(item.id);
                        }}
                        className="flex h-full w-full cursor-pointer items-center justify-center rounded-[8px] hover:bg-[linear-gradient(180deg,#ef4444,#dc2626)] hover:text-[#fff7f7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f87171]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
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

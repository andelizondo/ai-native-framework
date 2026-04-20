"use client";

import { useMemo, useState } from "react";

import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import type { FrameworkItem, WorkflowTaskCreateInput } from "@/lib/workflows/types";

const AGENTS = [
  ["PM", "pm"],
  ["Builder", "builder"],
  ["DevOps", "devops"],
  ["Designer", "designer"],
  ["Researcher", "researcher"],
  ["Project", "project"],
  ["Sales Ops", "sales-ops"],
  ["Finance Ops", "finance-ops"],
  ["Support", "support"],
  ["QA Engineer", "qa"],
] as const;

interface AddTaskModalProps {
  instanceId: string;
  roleId: string;
  stageId: string;
  roleName: string;
  stageName: string;
  skillOptions?: FrameworkItem[];
  playbookOptions?: FrameworkItem[];
  onClose: () => void;
  onCreate: (input: WorkflowTaskCreateInput) => void;
}

interface PickerProps {
  label: string;
  emptyLabel: string;
  searchPlaceholder: string;
  value: string;
  options: Array<{ id: string; name: string; description?: string; icon?: string | null }>;
  onSelect: (value: string) => void;
}

function SearchablePicker({
  label,
  emptyLabel,
  searchPlaceholder,
  value,
  options,
  onSelect,
}: PickerProps) {
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) =>
      [option.name, option.description ?? ""].some((field) =>
        field.toLowerCase().includes(normalized),
      ),
    );
  }, [options, query]);

  return (
    <div className="mb-3">
      <label className="mb-1.5 block text-[11px] font-medium text-t2">{label}</label>
      <div className="rounded-lg border border-border bg-bg-3">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-3.5 w-3.5 text-t3" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-[13px] text-t1 placeholder:text-t3 focus:outline-none"
          />
        </div>

        <div className="max-h-40 overflow-y-auto p-1.5">
          <button
            type="button"
            onClick={() => onSelect("")}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] transition",
              !value
                ? "bg-primary-bg text-accent"
                : "text-t2 hover:bg-bg-4 hover:text-t1",
            )}
          >
            <span className="text-[14px] text-t3">∅</span>
            <span>{emptyLabel}</span>
          </button>

          {filteredOptions.map((option) => {
            const selected = value === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelect(option.id)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition",
                  selected
                    ? "bg-primary-bg text-accent"
                    : "text-t2 hover:bg-bg-4 hover:text-t1",
                )}
              >
                <span className="mt-0.5 text-[14px] text-t3">
                  {option.icon || "•"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium">
                    {option.name}
                  </span>
                  {option.description ? (
                    <span className="mt-0.5 block truncate text-[10.5px] text-t3">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}

          {filteredOptions.length === 0 ? (
            <div className="px-2.5 py-3 text-[11.5px] text-t3">No matches found.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function AddTaskModal({
  instanceId,
  roleId,
  stageId,
  roleName,
  stageName,
  skillOptions = [],
  playbookOptions = [],
  onClose,
  onCreate,
}: AddTaskModalProps) {
  const [form, setForm] = useState<{
    title: string;
    description: string;
    agent: string | null;
    skill: string | null;
    playbook: string;
  }>({
    title: "",
    description: "",
    agent: "PM",
    skill: "pm",
    playbook: "",
  });

  const normalizedSkillOptions = useMemo(
    () =>
      (skillOptions.length > 0
        ? skillOptions
        : AGENTS.map(([name, id]) => ({
            id,
            name,
            description: "Built-in workflow skill",
            icon: null,
          }))) as Array<{
        id: string;
        name: string;
        description?: string;
        icon?: string | null;
      }>,
    [skillOptions],
  );

  const normalizedPlaybookOptions = useMemo(
    () =>
      playbookOptions.map((item) => ({
        id: item.name,
        name: item.name,
        description: item.description,
        icon: item.icon,
      })),
    [playbookOptions],
  );

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
        className="w-full max-w-[680px] rounded-[14px] border border-border-hi bg-bg-2 p-7 shadow-[var(--shadow-canvas)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-task-modal-title"
      >
        <div
          id="add-task-modal-title"
          className="text-[16px] font-bold tracking-tight text-t1"
        >
          New task
        </div>
        <div className="mb-[18px] mt-1 text-[12.5px] text-t3">
          {roleName} · {stageName}
        </div>

        <label className="mb-1.5 block text-[11px] font-medium text-t2">Title</label>
        <input
          autoFocus
          className="mb-3 block w-full rounded-lg border border-border bg-bg-3 px-3 py-2.5 text-[13px] text-t1 placeholder:text-t3 focus:border-primary focus:outline-none"
          placeholder="Task title"
          value={form.title}
          onChange={(event) =>
            setForm((current) => ({ ...current, title: event.target.value }))
          }
        />

        <label className="mb-1.5 block text-[11px] font-medium text-t2">
          Description
        </label>
        <input
          className="mb-3 block w-full rounded-lg border border-border bg-bg-3 px-3 py-2.5 text-[13px] text-t1 placeholder:text-t3 focus:border-primary focus:outline-none"
          placeholder="Brief description"
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
        />

        <div className="mb-3 grid gap-3 md:grid-cols-2">
          <SearchablePicker
            label="Agent skill"
            emptyLabel="No skill"
            searchPlaceholder="Search skills"
            value={form.skill ?? ""}
            options={normalizedSkillOptions}
            onSelect={(value) => {
              const selected = AGENTS.find((agent) => agent[1] === value);
              const selectedFrameworkSkill = normalizedSkillOptions.find(
                (option) => option.id === value,
              );
              setForm((current) => ({
                ...current,
                skill: value || null,
                agent: value
                  ? selected?.[0] ?? selectedFrameworkSkill?.name ?? current.agent
                  : null,
              }));
            }}
          />

          <SearchablePicker
            label="Playbook"
            emptyLabel="No playbook"
            searchPlaceholder="Search playbooks"
            value={form.playbook}
            options={normalizedPlaybookOptions}
            onSelect={(value) =>
              setForm((current) => ({ ...current, playbook: value }))
            }
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-border bg-bg-3 px-4 py-2 text-[13px] font-medium text-t2 transition hover:bg-bg-4 hover:text-t1"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary px-5 py-2 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!form.title.trim()}
            onClick={() => {
              if (!form.title.trim()) return;
              onCreate({
                instanceId,
                roleId,
                stageId,
                title: form.title,
                description: form.description,
                agent: form.agent,
                skill: form.skill,
                playbook: form.playbook,
              });
            }}
          >
            Create task →
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";

import type { WorkflowRole } from "@/lib/workflows/types";
import { cn } from "@/lib/utils";

const AVAILABLE_ROLES = [
  { label: "Sales", owner: "Assign owner", skill: "sales-ops", icon: "🤝" },
  { label: "Product", owner: "Assign owner", skill: "pm", icon: "📋" },
  { label: "Project Mgmt", owner: "Assign owner", skill: "project", icon: "🗂️" },
  { label: "Development", owner: "Assign owner", skill: "builder", icon: "⚡" },
  { label: "Infra / DevOps", owner: "Assign owner", skill: "devops", icon: "🔧" },
  { label: "Finance", owner: "Assign owner", skill: "finance-ops", icon: "💰" },
  { label: "Design", owner: "Assign owner", skill: "designer", icon: "🎨" },
  { label: "Quality", owner: "Assign owner", skill: "qa", icon: "✅" },
  { label: "Support", owner: "Assign owner", skill: "support", icon: "🎧" },
  { label: "Growth", owner: "Assign owner", skill: "growth", icon: "📈" },
  { label: "Research", owner: "Assign owner", skill: "researcher", icon: "🔍" },
  { label: "Strategy", owner: "Assign owner", skill: "strategist", icon: "🧭" },
] as const;

interface AddRoleModalProps {
  mode?: "create" | "edit";
  initialRole?: Pick<WorkflowRole, "label" | "owner">;
  onClose: () => void;
  onSubmit: (role: Pick<WorkflowRole, "label" | "owner">) => void;
}

export function AddRoleModal({
  mode = "create",
  initialRole,
  onClose,
  onSubmit,
}: AddRoleModalProps) {
  const initialPreset = useMemo(
    () => AVAILABLE_ROLES.find((role) => role.label === initialRole?.label),
    [initialRole?.label],
  );
  const [selectedLabel, setSelectedLabel] = useState<string>(initialRole?.label ?? "");
  const [customRole, setCustomRole] = useState(initialPreset ? "" : initialRole?.label ?? "");
  const [owner, setOwner] = useState(initialRole?.owner ?? "");

  const selectedPreset = AVAILABLE_ROLES.find((role) => role.label === selectedLabel);
  const usingCustom =
    (!selectedPreset && Boolean(initialRole?.label)) || Boolean(customRole.trim());

  const roleName = usingCustom
    ? customRole.trim() || initialRole?.label?.trim() || ""
    : selectedPreset?.label || "";
  const canSubmit = roleName.length > 0;

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
        className="w-full max-w-[500px] rounded-[14px] border border-border-hi bg-bg-2 p-7 shadow-[var(--shadow-canvas)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-role-modal-title"
      >
        <div id="add-role-modal-title" className="text-[16px] font-bold tracking-tight text-t1">
          {mode === "edit" ? "Edit role" : "Add role"}
        </div>
        <div className="mb-4 mt-1 text-[12.5px] text-t3">
          Choose from pre-defined roles or define a custom one.
        </div>

        <div className="mb-4 grid max-h-[220px] grid-cols-1 gap-2 overflow-y-auto md:grid-cols-3">
          {AVAILABLE_ROLES.map((role) => {
            const selected = role.label === selectedLabel && !usingCustom;
            return (
              <button
                key={role.label}
                type="button"
                onClick={() => {
                  setSelectedLabel(role.label);
                  setCustomRole("");
                  if (!owner.trim() && mode === "create") {
                    setOwner(role.owner);
                  }
                }}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition",
                  selected
                    ? "border-primary bg-primary-bg text-accent"
                    : "border-border bg-bg-3 text-t2 hover:bg-bg-4 hover:text-t1",
                )}
              >
                <span className="text-[16px]">{role.icon}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-semibold">
                    {role.label}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-t3">
                    {role.skill}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <label className="mb-1.5 block text-[11px] font-medium text-t2">
          Or custom role
        </label>
        <input
          value={customRole}
          onChange={(event) => {
            setCustomRole(event.target.value);
            setSelectedLabel("");
          }}
          placeholder="Custom role name"
          className="mb-3 block w-full rounded-lg border border-border bg-bg-3 px-3 py-2.5 text-[13px] text-t1 placeholder:text-t3 focus:border-primary focus:outline-none"
        />

        <label className="mb-1.5 block text-[11px] font-medium text-t2">
          Owner (optional)
        </label>
        <input
          value={owner}
          onChange={(event) => setOwner(event.target.value)}
          placeholder="Name or team"
          className="mb-5 block w-full rounded-lg border border-border bg-bg-3 px-3 py-2.5 text-[13px] text-t1 placeholder:text-t3 focus:border-primary focus:outline-none"
        />

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
              if (!canSubmit) return;
              const resolvedPreset = selectedPreset || initialPreset;
              onSubmit({
                label: roleName,
                owner: owner.trim() || resolvedPreset?.owner || "Unassigned",
              });
              onClose();
            }}
            className="rounded-lg bg-primary px-5 py-2 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mode === "edit" ? "Save role →" : "Add role →"}
          </button>
        </div>
      </div>
    </div>
  );
}

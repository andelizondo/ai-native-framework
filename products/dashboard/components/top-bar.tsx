"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, Pencil } from "lucide-react";

import { useDashboardTopBar } from "@/components/dashboard-topbar-context";
import { CheckpointPanel } from "@/components/workflows/checkpoint-panel";
import { cn } from "@/lib/utils";

/**
 * Dashboard top bar.
 *
 * Renders a route-derived breadcrumb and the My Tasks pill. The pill shows an
 * amber badge when there are pending checkpoints and opens CheckpointPanel on
 * click. `initialPendingCount` is server-rendered for a fast first paint;
 * the panel refreshes from the DB when opened.
 *
 * Visual contract: prototype `TopBar` (`Process Canvas.html`).
 */

const WORKFLOW_INSTANCE_ROUTE_REGEX = /^\/workflows\/(?!templates(?:\/|$))[^/]+\/?$/;
const WORKFLOW_TEMPLATE_EDIT_ROUTE_REGEX = /^\/workflows\/templates\/[^/]+\/edit\/?$/;

const ROUTE_LABELS: ReadonlyArray<{ test: (path: string) => boolean; crumbs: string[] }> = [
  { test: (p) => p === "/", crumbs: ["Overview"] },
  { test: (p) => p === "/framework/skills" || p.startsWith("/framework/skills/"), crumbs: ["Skills"] },
  { test: (p) => p === "/framework/playbooks" || p.startsWith("/framework/playbooks/"), crumbs: ["Playbooks"] },
  { test: (p) => p === "/events" || p.startsWith("/events/"), crumbs: ["Event Feed"] },
  { test: (p) => p === "/settings" || p.startsWith("/settings/"), crumbs: ["Settings"] },
  {
    test: (p) => WORKFLOW_INSTANCE_ROUTE_REGEX.test(p),
    crumbs: ["Workflows", "Instance"],
  },
  {
    test: (p) => WORKFLOW_TEMPLATE_EDIT_ROUTE_REGEX.test(p),
    crumbs: ["Workflows", "Template editor"],
  },
];

function deriveCrumbs(pathname: string | null): string[] {
  if (!pathname) return ["Overview"];
  for (const entry of ROUTE_LABELS) {
    if (entry.test(pathname)) return entry.crumbs;
  }
  const last = pathname.split("/").filter(Boolean).pop() ?? "Overview";
  return [last.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())];
}

export interface TopBarProps {
  /** Server-rendered initial count for fast first paint. */
  initialPendingCount?: number;
}

export function TopBar({ initialPendingCount = 0 }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { config } = useDashboardTopBar();
  const crumbs = deriveCrumbs(pathname);
  const isWorkflowInstanceRoute =
    !!pathname && WORKFLOW_INSTANCE_ROUTE_REGEX.test(pathname);
  const editMode = searchParams.get("edit") === "1";

  const [panelOpen, setPanelOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(initialPendingCount);

  function toggleEditMode() {
    if (!pathname) return;
    const next = new URLSearchParams(searchParams.toString());
    if (editMode) {
      next.delete("edit");
    } else {
      next.set("edit", "1");
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const hasPending = pendingCount > 0;

  return (
    <>
      <header
        className="flex h-[52px] shrink-0 items-center gap-2.5 border-b border-border bg-bg px-5"
        data-testid="topbar-header"
      >
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5">
          {crumbs.map((crumb, idx) => {
            const isLast = idx === crumbs.length - 1;
            return (
              <span key={`${crumb}-${idx}`} className="flex items-center gap-1.5">
                {idx > 0 && <span className="text-t3">›</span>}
                {isLast && config?.mode === "template-editor" ? (
                  <input
                    value={config.label}
                    onChange={(event) => config.onLabelChange(event.target.value)}
                    className="tb-crumb-editable min-w-[140px]"
                    aria-label="Workflow template name"
                  />
                ) : (
                  <span
                    className={
                      isLast
                        ? "truncate text-[13px] font-semibold text-t1"
                        : "truncate text-[13px] font-medium text-t2"
                    }
                    aria-current={isLast ? "page" : undefined}
                  >
                    {crumb}
                  </span>
                )}
              </span>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          {config?.mode === "template-editor" ? (
            <button
              type="button"
              onClick={config.onSave}
              disabled={config.saveDisabled}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                config.saveDisabled
                  ? "cursor-not-allowed border border-border bg-bg-2 text-t3 opacity-70"
                  : "border border-[#10b981] bg-[#10b981] text-white shadow-[0_0_0_1px_rgba(16,185,129,0.16),0_8px_22px_rgba(16,185,129,0.24)] hover:bg-[#22c55e]",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  config.saveDisabled ? "bg-t3" : "bg-white shadow-[0_0_10px_rgba(255,255,255,0.7)]",
                )}
              />
              Save
            </button>
          ) : null}

          {isWorkflowInstanceRoute ? (
            <button
              type="button"
              aria-pressed={editMode}
              onClick={toggleEditMode}
              title={editMode ? "Finish editing tasks" : "Edit workflow tasks"}
              className={
                editMode
                  ? "flex cursor-pointer items-center gap-1.5 rounded-md border border-primary bg-primary-bg px-2.5 py-1.5 text-[11.5px] font-medium text-accent shadow-[inset_0_0_0_1px_rgba(99,102,241,0.08)] transition hover:bg-[rgba(99,102,241,0.16)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  : "flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-bg-2 px-2.5 py-1.5 text-[11.5px] font-medium text-t2 transition hover:border-border-hi hover:bg-bg-3 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              }
            >
              <Pencil className="h-3.5 w-3.5" />
              {editMode ? "Done" : "Edit"}
            </button>
          ) : null}

          {config?.mode !== "template-editor" ? (
            <button
              type="button"
              aria-label={`My Tasks${hasPending ? ` — ${pendingCount} pending` : ""}`}
              aria-expanded={panelOpen}
              onClick={() => setPanelOpen((v) => !v)}
              data-testid="topbar-my-tasks-btn"
              className={cn(
                "relative flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11.5px] font-medium transition",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                hasPending
                  ? "border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.08)] text-[#fbbf24] hover:bg-[rgba(245,158,11,0.14)]"
                  : "border-border bg-bg-2 text-t2 hover:border-border-hi hover:bg-bg-3 hover:text-t1",
              )}
            >
              <Bell className="h-3.5 w-3.5" />
              My Tasks
              {hasPending && (
                <span
                  className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#f59e0b] px-1 font-mono text-[9px] font-bold text-white"
                  aria-hidden
                  data-testid="topbar-pending-badge"
                >
                  {pendingCount}
                </span>
              )}
            </button>
          ) : null}
        </div>
      </header>

      <CheckpointPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onPendingCountChange={setPendingCount}
      />
    </>
  );
}

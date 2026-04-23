"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Pencil } from "lucide-react";

import {
  type DashboardTopBarCrumb,
  useDashboardTopBar,
} from "@/components/dashboard-topbar-context";
import { cn } from "@/lib/utils";

/**
 * Dashboard top bar.
 *
 * Renders a route-derived breadcrumb plus route-specific controls.
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

function deriveCrumbs(pathname: string | null): DashboardTopBarCrumb[] {
  if (!pathname) return [{ label: "Overview" }];
  for (const entry of ROUTE_LABELS) {
    if (entry.test(pathname)) {
      return entry.crumbs.map((label) => ({ label }));
    }
  }
  const last = pathname.split("/").filter(Boolean).pop() ?? "Overview";
  return [{ label: last.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) }];
}

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { config } = useDashboardTopBar();
  const crumbs = config?.crumbs ?? deriveCrumbs(pathname);
  const isWorkflowInstanceRoute =
    !!pathname && WORKFLOW_INSTANCE_ROUTE_REGEX.test(pathname);
  const editMode = searchParams.get("edit") === "1";

  const [templateLabelDraft, setTemplateLabelDraft] = useState("");

  useEffect(() => {
    if (config?.mode === "template-editor") {
      setTemplateLabelDraft(config.label);
    }
  }, [config]);

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

  const saveDisabled =
    config?.mode === "template-editor"
      ? config.saveDisabled
      : config?.mode === "page"
        ? (config.saveDisabled ?? true)
        : true;
  const showSaveButton =
    (config?.mode === "template-editor" || config?.mode === "page") &&
    typeof config.onSave === "function";

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
              <span key={`${crumb.label}-${idx}`} className="flex items-center gap-1.5">
                {idx > 0 && <span className="text-t3">›</span>}
                {isLast && config?.mode === "template-editor" ? (
                  <input
                    value={templateLabelDraft}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setTemplateLabelDraft(nextValue);
                      config.onLabelChange(nextValue);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void config.onSave();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setTemplateLabelDraft(config.label);
                        config.onLabelChange(config.label);
                      }
                    }}
                    className="min-w-[140px] bg-transparent p-0 text-[13px] font-semibold text-t1 outline-none placeholder:text-t3"
                    aria-label="Workflow template name"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={crumb.onClick}
                    disabled={!crumb.onClick || isLast}
                    className={
                      isLast
                        ? "truncate text-[13px] font-semibold text-t1"
                        : cn(
                            "truncate text-[13px] font-medium text-t2 transition",
                            crumb.onClick
                              ? "cursor-pointer hover:text-t1"
                              : "cursor-default",
                          )
                    }
                    aria-current={isLast ? "page" : undefined}
                  >
                    {crumb.label}
                  </button>
                )}
              </span>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          {config?.mode === "template-editor" ? (
            <>
              {config.actions ?? null}
            </>
          ) : (
            config?.actions ?? null
          )}

          {showSaveButton ? (
            <button
              type="button"
              onClick={config.onSave}
              disabled={saveDisabled}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                saveDisabled
                  ? "cursor-not-allowed border border-border bg-bg-2 text-t3 opacity-70"
                  : "border border-[#10b981] bg-[#10b981] text-white shadow-[0_0_0_1px_rgba(16,185,129,0.16),0_8px_22px_rgba(16,185,129,0.24)] hover:bg-[#22c55e]",
              )}
            >
              {!saveDisabled ? (
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.7)]"
                />
              ) : null}
              Save
            </button>
          ) : null}

          {isWorkflowInstanceRoute ? (
            <button
              type="button"
              aria-pressed={editMode}
              onClick={toggleEditMode}
              title={editMode ? "Save workflow changes" : "Edit workflow tasks"}
              className={
                editMode
                  ? "flex cursor-pointer items-center gap-1.5 rounded-md border border-primary bg-primary-bg px-2.5 py-1.5 text-[11.5px] font-medium text-accent shadow-[inset_0_0_0_1px_rgba(99,102,241,0.08)] transition hover:bg-[rgba(99,102,241,0.16)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  : "flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-bg-2 px-2.5 py-1.5 text-[11.5px] font-medium text-t2 transition hover:border-border-hi hover:bg-bg-3 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              }
            >
              <Pencil className="h-3.5 w-3.5" />
              {editMode ? "Save" : "Edit"}
            </button>
          ) : null}
        </div>
      </header>
    </>
  );
}

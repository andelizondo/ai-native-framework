"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Pencil, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  WorkflowInstance,
  WorkflowTemplate,
} from "@/lib/workflows/types";

import { CreateInstanceModal } from "./create-instance-modal";

/**
 * Sidebar workflow tree — one collapsible section per template, with the
 * template's instances listed underneath and a per-template "+ New
 * instance" trigger that opens the create-instance modal scoped to that
 * template.
 *
 * Visual contract: prototype `Sidebar.WorkflowTree` block (`Process
 * Canvas.html` lines 494-538) and the `pt-*` class definitions in the
 * same file (lines 75-103). The shape mirrored here:
 *
 *   pt-header  → arrow · name(flex-1) · count-pill · [pending-dot]
 *   pt-instances (indent 16px)
 *     pt-instance → 5px dot · name(flex-1) · progress-bar(36px)
 *     pt-new     → "+ New instance" (always last)
 *
 * Per the issue acceptance criteria the workflow name uses the template
 * color (the prototype uses `--t2`); every other token follows the
 * prototype literally so the visual matches Process Canvas. Two further
 * deliberate tweaks vs. the prototype:
 *   - the active-instance label is left at `--t2` (prototype paints it
 *     `--accent`); the indigo row background already signals selection
 *     and the colored dot reinforces the template grouping;
 *   - every instance dot stays at the template color regardless of
 *     active/pending state — this matches the collapsed-mode rendering
 *     (one template-colored dot per instance) so the visual language
 *     stays consistent across collapsed/expanded.
 *
 * Pending state: if any task on an instance is in `pending_approval`,
 * the parent template header surfaces a small amber pending dot. The
 * instance dot itself does not change color; the row's amber pip is
 * what calls the user's attention. PR 5 has no live task aggregation,
 * so `hasPending` defaults to `false` and the visual stays inactive
 * until PR 8 wires the task drawer.
 */

export interface SidebarInstanceView extends WorkflowInstance {
  /** True when any task on the instance is `pending_approval`. */
  hasPending?: boolean;
  /**
   * Completion ratio in [0, 1]. Optional because we don't have task
   * counts yet in PR 5; falls back to a status-derived approximation.
   */
  progress?: number;
}

interface Props {
  templates: WorkflowTemplate[];
  instancesByTemplate: Record<string, SidebarInstanceView[]>;
}

/**
 * Status → progress fallback used when the parent hasn't computed an
 * exact ratio. Intentionally coarse so the bar matches the prototype's
 * "feels right" look for empty instances.
 */
function fallbackProgress(status: WorkflowInstance["status"]): number {
  switch (status) {
    case "complete":
      return 1;
    case "active":
      return 0.4;
    case "blocked":
      return 0.25;
    case "not_started":
    default:
      return 0;
  }
}

function instanceHref(instanceId: string): string {
  return `/workflows/${instanceId}`;
}

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Collapsed-mode instance dot. The visible dot is small (10–14px) but the
 * link itself is a 24×24 hit-box for comfortable clicking. Hover/focus
 * grows the dot, brightens it, and surfaces a tooltip with the
 * "Template · Instance" label.
 *
 * The tooltip is rendered via `createPortal(..., document.body)` so it
 * escapes the sidebar's `overflow-x-hidden` scroll container; without
 * the portal, an absolutely-positioned tooltip would be clipped by the
 * sidebar walls. Position is computed from the link's bounding rect on
 * each show, so we don't have to subscribe to scroll/resize events
 * (the tooltip only lives while the user hovers/focuses, and we
 * reposition on show).
 */
interface CollapsedInstanceDotProps {
  instance: SidebarInstanceView;
  template: WorkflowTemplate;
  active: boolean;
}

function CollapsedInstanceDot({
  instance,
  template,
  active,
}: CollapsedInstanceDotProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  function reveal() {
    const rect = linkRef.current?.getBoundingClientRect();
    if (rect) {
      setCoords({
        top: rect.top + rect.height / 2,
        left: rect.right + 8,
      });
    }
    setOpen(true);
  }

  const tooltip = `${template.label} · ${instance.label}`;
  const href = instanceHref(instance.id);

  return (
    <>
      <Link
        ref={linkRef}
        href={href}
        aria-label={tooltip}
        aria-current={active ? "page" : undefined}
        data-testid={`workflow-instance-dot-${instance.id}`}
        onMouseEnter={reveal}
        onMouseLeave={() => setOpen(false)}
        onFocus={reveal}
        onBlur={() => setOpen(false)}
        className={cn(
          "group/dot flex h-6 w-6 items-center justify-center rounded-full",
          "transition-transform duration-150 ease-out",
          "hover:scale-110 focus-visible:scale-110",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-2",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "block h-2.5 w-2.5 rounded-full",
            "transition-[width,height,box-shadow,filter] duration-150 ease-out",
            "group-hover/dot:h-3.5 group-hover/dot:w-3.5",
            "group-focus-visible/dot:h-3.5 group-focus-visible/dot:w-3.5",
            !active && "opacity-80 group-hover/dot:opacity-100",
          )}
          style={{
            backgroundColor: template.color,
            boxShadow: active
              ? `0 0 0 2px var(--bg-2), 0 0 0 3px ${template.color}`
              : undefined,
          }}
        />
      </Link>
      {mounted &&
        open &&
        createPortal(
          <div
            role="tooltip"
            data-testid={`workflow-instance-tooltip-${instance.id}`}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              // The dot is anchored at the right edge of the link's
              // bounding rect; offset by 8px (set in `reveal`) so the
              // tooltip floats just past the dot. Translate up by half
              // its own height to vertically center on the dot.
              transform: "translate(0, -50%)",
              zIndex: 60,
              animation:
                "ainative-tooltip-in 120ms cubic-bezier(0.16, 1, 0.3, 1) both",
            }}
            className={cn(
              "pointer-events-none whitespace-nowrap rounded-md border border-border-hi bg-bg-2 px-2 py-1",
              "text-[11px] font-medium text-t1 shadow-[var(--shadow-canvas)]",
            )}
          >
            <span className="text-t3">{template.label}</span>
            <span className="mx-1 text-t3">·</span>
            <span>{instance.label}</span>
          </div>,
          document.body,
        )}
    </>
  );
}

export function SidebarWorkflowTree({ templates, instancesByTemplate }: Props) {
  const pathname = usePathname();

  // Default every template to expanded — the prototype shows them open
  // and there are usually <10 templates, so collapse-all-by-default
  // would feel empty.
  const defaultExpanded = useMemo(() => {
    const acc: Record<string, boolean> = {};
    for (const t of templates) acc[t.id] = true;
    return acc;
  }, [templates]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>(defaultExpanded);
  const [modalTemplate, setModalTemplate] = useState<WorkflowTemplate | null>(null);

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: prev[id] === false }));
  }

  if (templates.length === 0) {
    return (
      <>
        <div
          data-sidebar-collapsible
          data-testid="sidebar-workflows-empty"
          className="rounded-md border border-dashed border-border px-3 py-3 text-[11px] leading-relaxed text-t3"
        >
          No workflows yet. Define a workflow template to start tracking
          instances here.
        </div>
        {/* Collapsed-mode placeholder — keeps vertical rhythm without
            rendering text the user can't read in icon-only mode. */}
        <div data-sidebar-when-collapsed className="hidden" aria-hidden />
      </>
    );
  }

  return (
    <>
      {/* Collapsed mode: one template-colored dot per instance.
          Clicking a dot navigates to that instance. Templates with no
          instances render nothing — the "+ New workflow" button in the
          sidebar header is the collapsed-mode affordance for adding
          work. See `CollapsedInstanceDot` for the dot/hit-box/tooltip
          contract (portal-rendered tooltip to escape the sidebar's
          horizontal-overflow clipping). */}
      <div
        data-sidebar-when-collapsed
        className="flex flex-col items-center gap-1 py-1"
      >
        {templates.flatMap((template) => {
          const instances = instancesByTemplate[template.id] ?? [];
          return instances.map((instance) => (
            <CollapsedInstanceDot
              key={instance.id}
              instance={instance}
              template={template}
              active={isActive(pathname, instanceHref(instance.id))}
            />
          ));
        })}
      </div>

      <div data-sidebar-collapsible className="space-y-1.5">
        {templates.map((template) => {
          const instances = instancesByTemplate[template.id] ?? [];
          const isOpen = expanded[template.id] !== false;
          const templateHasPending = instances.some((i) => i.hasPending);

          return (
            <section key={template.id} aria-label={`${template.label} workflow`}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggle(template.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle(template.id);
                  }
                }}
                aria-expanded={isOpen}
                aria-controls={`tpl-${template.id}-list`}
                data-testid={`workflow-template-toggle-${template.id}`}
                className="group flex cursor-pointer select-none items-center gap-1.5 rounded-md px-2 py-[5px] hover:bg-bg-3 transition-colors"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center text-t3 transition-transform duration-150",
                    isOpen && "rotate-90",
                  )}
                >
                  <ChevronRight className="h-3 w-3" />
                </span>
                <span
                  className="min-w-0 flex-1 truncate text-[12.5px] font-semibold"
                  // Acceptance-criteria override: the prototype renders
                  // the workflow name in `--t2`, but the AEL-48 issue
                  // explicitly requires "workflow name colored with
                  // template color" so glanceable scanning works.
                  style={{ color: template.color }}
                >
                  {template.label}
                </span>

                {/* Count pill — number by default, pen icon on hover.
                    Mirrors prototype's `pt-count-pill`/`pt-count-edit`
                    pair (lines 86-90). The pen click navigates to the
                    template-editor stub (PR 11 wires the real route). */}
                <Link
                  href={`/workflows/templates/${template.id}/edit`}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Edit ${template.label} template (${instances.length} ${
                    instances.length === 1 ? "instance" : "instances"
                  })`}
                  data-testid={`workflow-template-count-${template.id}`}
                  className="ml-1.5 flex h-[18px] min-w-[22px] shrink-0 items-center justify-center rounded-full border border-border bg-bg-4 px-1.5 font-mono text-[9px] font-semibold text-t3 transition-colors group-hover:border-accent group-hover:bg-primary-bg group-hover:text-accent"
                >
                  <span className="block group-hover:hidden">
                    {instances.length}
                  </span>
                  <span className="hidden group-hover:block">
                    <Pencil className="h-2.5 w-2.5" />
                  </span>
                </Link>

                {templateHasPending && (
                  <span
                    aria-label="Pending checkpoints"
                    title="Pending checkpoints"
                    className="ml-[3px] inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: "var(--pill-pending-d)",
                      boxShadow: "0 0 4px rgba(245,158,11,0.6)",
                    }}
                  />
                )}
              </div>

              {isOpen && (
                <ul
                  id={`tpl-${template.id}-list`}
                  className="mb-0.5 space-y-0 pl-4"
                >
                  {instances.map((instance) => {
                    const href = instanceHref(instance.id);
                    const active = isActive(pathname, href);
                    // Always template color so the dot reads as "this
                    // instance belongs to <template>" regardless of
                    // active/pending — matches the collapsed-mode dots.
                    const dotColor = template.color;
                    const ratio = Math.max(
                      0,
                      Math.min(
                        1,
                        typeof instance.progress === "number"
                          ? instance.progress
                          : fallbackProgress(instance.status),
                      ),
                    );

                    return (
                      <li key={instance.id}>
                        <Link
                          href={href}
                          aria-current={active ? "page" : undefined}
                          data-testid={`workflow-instance-link-${instance.id}`}
                          className={cn(
                            "flex items-center gap-[7px] rounded-md px-2 py-[5px] transition-colors",
                            active
                              ? "bg-primary-bg"
                              : "hover:bg-bg-3",
                          )}
                        >
                          <span
                            aria-hidden
                            className="inline-block h-[5px] w-[5px] shrink-0 rounded-full"
                            style={{ backgroundColor: dotColor }}
                          />
                          <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-t2">
                            {instance.label}
                          </span>
                          {instance.hasPending && (
                            <span
                              aria-label="Pending checkpoints"
                              title="Pending checkpoints"
                              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                              // Same design token as the template-level
                              // pending dot above, so changing the
                              // pending hue in `globals.css` updates
                              // both surfaces in one place.
                              style={{
                                backgroundColor: "var(--pill-pending-d)",
                                boxShadow: "0 0 5px var(--pill-pending-d)",
                              }}
                            />
                          )}
                          <span
                            aria-hidden
                            className="block h-[2.5px] w-9 shrink-0 overflow-hidden rounded-[2px] bg-bg-4"
                          >
                            <span
                              className="block h-full rounded-[2px] transition-[width] duration-300"
                              style={{
                                width: `${Math.round(ratio * 100)}%`,
                                backgroundColor: template.color,
                              }}
                            />
                          </span>
                        </Link>
                      </li>
                    );
                  })}

                  <li>
                    <button
                      type="button"
                      onClick={() => setModalTemplate(template)}
                      data-testid={`workflow-new-instance-${template.id}`}
                      className="flex w-full items-center gap-1.5 rounded-md px-2 py-[5px] text-left text-[11.5px] font-medium text-t3 transition-colors hover:bg-bg-3 hover:text-accent"
                    >
                      <span className="opacity-50">
                        <Plus className="h-3 w-3" />
                      </span>
                      New instance
                    </button>
                  </li>
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <CreateInstanceModal
        template={modalTemplate}
        open={modalTemplate !== null}
        onClose={() => setModalTemplate(null)}
      />
    </>
  );
}

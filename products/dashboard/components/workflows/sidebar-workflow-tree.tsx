"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  WorkflowInstance,
  WorkflowTemplate,
} from "@/lib/workflows/types";

import { CreateInstanceModal } from "./create-instance-modal";

export interface SidebarInstanceView extends WorkflowInstance {
  /** True when any task on the instance is `pending_approval`. */
  hasPending?: boolean;
}

interface Props {
  templates: WorkflowTemplate[];
  instancesByTemplate: Record<string, SidebarInstanceView[]>;
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
              <div className="group flex select-none items-center gap-1 rounded-md py-[3px] pl-1 pr-2 hover:bg-bg-3 transition-colors">
                <button
                  type="button"
                  onClick={() => toggle(template.id)}
                  aria-expanded={isOpen}
                  aria-controls={`tpl-${template.id}-list`}
                  aria-label={isOpen ? "Collapse" : "Expand"}
                  data-testid={`workflow-template-toggle-${template.id}`}
                  className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-t3 transition-colors hover:text-t1"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center transition-transform duration-150",
                      isOpen && "rotate-90",
                    )}
                  >
                    <ChevronRight className="h-3 w-3" />
                  </span>
                </button>

                <Link
                  href={`/workflows/templates/${template.id}/edit`}
                  data-testid={`workflow-template-link-${template.id}`}
                  className="min-w-0 flex-1 truncate rounded px-1 py-0.5 text-[13.5px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                  style={{ color: template.color }}
                >
                  {template.label}
                </Link>

                {templateHasPending && (
                  <span
                    aria-label="Pending checkpoints"
                    title="Pending checkpoints"
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: "var(--pill-pending-d)",
                      boxShadow: "0 0 4px rgba(245,158,11,0.6)",
                    }}
                  />
                )}

                <button
                  type="button"
                  aria-label={`New ${template.label} instance`}
                  title={`New ${template.label} instance`}
                  data-testid={`workflow-new-instance-${template.id}`}
                  onClick={() => setModalTemplate(template)}
                  className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border border-border text-t3 transition-colors hover:border-accent hover:text-accent"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              {isOpen && (
                <ul
                  id={`tpl-${template.id}-list`}
                  className="mb-0.5 space-y-0 pl-5"
                >
                  {instances.map((instance) => {
                    const href = instanceHref(instance.id);
                    const active = isActive(pathname, href);
                    const dotColor = template.color;

                    return (
                      <li key={instance.id}>
                        <Link
                          href={href}
                          aria-current={active ? "page" : undefined}
                          data-testid={`workflow-instance-link-${instance.id}`}
                          className={cn(
                            "relative flex items-center gap-2 rounded-md px-2 py-[5px] transition-colors",
                            active
                              ? "bg-primary-bg text-accent"
                              : "hover:bg-bg-3",
                          )}
                        >
                          {active && (
                            <span
                              aria-hidden
                              className="absolute left-0 top-1/2 h-[60%] w-[2px] -translate-y-1/2 rounded-r bg-accent"
                            />
                          )}
                          <span
                            aria-hidden
                            className="inline-block h-[7px] w-[7px] shrink-0 rounded-full"
                            style={{ backgroundColor: dotColor }}
                          />
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate text-[12.5px]",
                              active ? "font-semibold text-accent" : "font-medium text-t2",
                            )}
                          >
                            {instance.label}
                          </span>
                          {instance.hasPending && (
                            <span
                              aria-label="Pending checkpoints"
                              title="Pending checkpoints"
                              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{
                                backgroundColor: "var(--pill-pending-d)",
                                boxShadow: "0 0 5px var(--pill-pending-d)",
                              }}
                            />
                          )}
                        </Link>
                      </li>
                    );
                  })}
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

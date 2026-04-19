"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, Pencil } from "lucide-react";

/**
 * Dashboard top bar.
 *
 * The shell ships before any real workflow / instance routing exists.
 * The top bar therefore renders a route-derived breadcrumb (Overview,
 * Skills, Playbooks, Event Feed, Settings) and an inert "My Tasks"
 * pill so the prototype's chrome is in place; PRs that introduce
 * workflow instances and the My-Tasks list will replace the
 * placeholder values.
 *
 * Visual contract: prototype `TopBar` (`Process Canvas.html`).
 */

const ROUTE_LABELS: ReadonlyArray<{ test: (path: string) => boolean; crumbs: string[] }> = [
  { test: (p) => p === "/", crumbs: ["Overview"] },
  { test: (p) => p === "/framework/skills" || p.startsWith("/framework/skills/"), crumbs: ["Skills"] },
  { test: (p) => p === "/framework/playbooks" || p.startsWith("/framework/playbooks/"), crumbs: ["Playbooks"] },
  { test: (p) => p === "/events" || p.startsWith("/events/"), crumbs: ["Event Feed"] },
  { test: (p) => p === "/settings" || p.startsWith("/settings/"), crumbs: ["Settings"] },
  // Workflow instance routes carry the instance label in the page itself,
  // so the breadcrumb stays generic until per-instance metadata is wired.
  // Match exactly one segment after `/workflows/` so sub-routes like
  // `/workflows/templates/new` (PR11 stub) don't pick up the instance crumb.
  // The negative lookahead excludes known reserved roots (currently just
  // `templates`) so future top-level workflow sections — added before
  // they get their own ROUTE_LABELS entry — don't get mis-labelled as
  // an instance crumb.
  {
    test: (p) =>
      /^\/workflows\/(?!templates(?:\/|$))[^/]+\/?$/.test(p),
    crumbs: ["Workflows", "Instance"],
  },
];

function deriveCrumbs(pathname: string | null): string[] {
  if (!pathname) return ["Overview"];
  for (const entry of ROUTE_LABELS) {
    if (entry.test(pathname)) return entry.crumbs;
  }
  // Fallback: humanise the last path segment so future routes that land
  // before they're added to the table still get a sensible breadcrumb.
  const last = pathname.split("/").filter(Boolean).pop() ?? "Overview";
  return [last.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())];
}

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const crumbs = deriveCrumbs(pathname);
  const isWorkflowInstanceRoute =
    !!pathname && /^\/workflows\/(?!templates(?:\/|$))[^/]+\/?$/.test(pathname);
  const editMode = searchParams.get("edit") === "1";

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

  return (
    <header className="flex h-[52px] shrink-0 items-center gap-2.5 border-b border-border bg-bg px-5">
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5">
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1;
          return (
            <span key={`${crumb}-${idx}`} className="flex items-center gap-1.5">
              {idx > 0 && <span className="text-t3">›</span>}
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
            </span>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-1.5">
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
        <button
          type="button"
          disabled
          aria-label="My Tasks (coming soon)"
          title="My Tasks — coming soon"
          className="relative flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-bg-2 px-2.5 py-1.5 text-[11.5px] font-medium text-t2 opacity-70"
        >
          <Bell className="h-3.5 w-3.5" />
          My Tasks
        </button>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  LogOut,
  Moon,
  Plus,
  Rss,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  User as UserIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useSidebarCollapsed } from "@/lib/sidebar";
import { useTheme } from "@/lib/theme";
import { useSignOut } from "@/lib/auth/use-sign-out";
import type { AuthUser } from "@/lib/auth/types";
import type { WorkflowTemplate } from "@/lib/workflows/types";
import {
  SidebarWorkflowTree,
  type SidebarInstanceView,
} from "@/components/workflows/sidebar-workflow-tree";

/**
 * Dashboard left rail.
 *
 * Visual contract is the AI-Native Process Canvas prototype
 * (`/tmp/design-canvas/.../Process Canvas.html`, `Sidebar` function +
 * `[data-theme]` tokens). Markup stays static in both states; the
 * collapse visual is driven by `<html data-sidebar>` via the rules
 * in `app/globals.css`, so SSR and client first render agree even
 * before the persisted preference hydrates.
 *
 * PR-3 scope: structural chrome only — workflow tree, instance
 * navigation, and the Skills/Playbooks/Events/Settings screens are
 * placeholders awaiting later PRs (workflow canvas, framework editors,
 * event feed, settings). The user menu wires to the existing
 * `useSignOut` flow so it cannot drift from `<SignOutButton />`.
 */

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: ReactNode;
};

const FRAMEWORK_NAV: ReadonlyArray<NavItem> = [
  { id: "skills", label: "Skills", href: "/framework/skills", icon: <Sparkles className="h-4 w-4" /> },
  { id: "playbooks", label: "Playbooks", href: "/framework/playbooks", icon: <BookOpen className="h-4 w-4" /> },
];

const WORKSPACE_NAV: ReadonlyArray<NavItem> = [
  { id: "events", label: "Event Feed", href: "/events", icon: <Rss className="h-4 w-4" /> },
  { id: "settings", label: "Settings", href: "/settings", icon: <SettingsIcon className="h-4 w-4" /> },
];

const OVERVIEW_NAV: NavItem = {
  id: "overview",
  label: "Overview",
  href: "/",
  icon: <LayoutGrid className="h-4 w-4" />,
};

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNavLink({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string | null;
}) {
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      data-sidebar-nav
      aria-current={active ? "page" : undefined}
      title={item.label}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] font-medium transition-colors",
        active
          ? "bg-primary-bg text-accent"
          : "text-t2 hover:bg-bg-3 hover:text-t1",
      )}
    >
      <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center", active ? "opacity-100" : "opacity-60")}>
        {item.icon}
      </span>
      <span className="truncate" data-sidebar-collapsible>
        {item.label}
      </span>
    </Link>
  );
}

function UserMenu({
  open,
  onClose,
  onThemeToggle,
  onSignOut,
  signingOut,
  signOutError,
  isDark,
}: {
  open: boolean;
  onClose: () => void;
  onThemeToggle: () => void;
  onSignOut: () => void;
  signingOut: boolean;
  signOutError: string | null;
  isDark: boolean;
}) {
  if (!open) return null;
  return (
    <div
      role="menu"
      aria-label="User menu"
      className="absolute bottom-[calc(100%+4px)] left-2.5 right-2.5 z-20 rounded-[10px] border border-border-hi bg-bg-3 p-1.5 shadow-[var(--shadow-canvas)]"
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onThemeToggle();
          onClose();
        }}
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[12.5px] text-t2 hover:bg-bg-4 hover:text-t1 transition-colors"
      >
        <span className="flex h-3.5 w-3.5 items-center justify-center">
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </span>
        {isDark ? "Light mode" : "Dark mode"}
      </button>

      <div className="my-1 h-px bg-border" />

      <button
        type="button"
        role="menuitem"
        disabled
        title="Coming soon"
        className="flex w-full cursor-not-allowed items-center gap-2 rounded-md px-2.5 py-2 text-[12.5px] text-t2 opacity-60"
      >
        <UserIcon className="h-3.5 w-3.5" />
        Profile settings
      </button>

      <div className="my-1 h-px bg-border" />

      {signOutError && (
        <p
          role="alert"
          aria-live="polite"
          id="sidebar-signout-error"
          className="px-2.5 py-1 text-[11px] text-(color:--pill-blocked-t)"
        >
          {signOutError}
        </p>
      )}

      <button
        type="button"
        role="menuitem"
        onClick={onSignOut}
        disabled={signingOut}
        aria-describedby={signOutError ? "sidebar-signout-error" : undefined}
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[12.5px] text-(color:--pill-blocked-t) hover:bg-(--pill-blocked-bg) disabled:opacity-60 transition-colors"
      >
        <LogOut className="h-3.5 w-3.5" />
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}

export interface SidebarProps {
  user: AuthUser;
  /**
   * Workflow templates fetched server-side in `app/(dashboard)/layout.tsx`
   * via `getServerWorkflowRepository().getTemplates()`. Defaults to an
   * empty array so legacy callers (and tests that don't care about the
   * tree) still render the empty-state placeholder.
   */
  templates?: WorkflowTemplate[];
  /**
   * Instances grouped by `template_id`. Each instance may carry an
   * optional `hasPending` flag (derived once the parent has task data
   * — currently always `false` — and a `progress` ratio.
   */
  instancesByTemplate?: Record<string, SidebarInstanceView[]>;
}

export function Sidebar({
  user,
  templates = [],
  instancesByTemplate = {},
}: SidebarProps) {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();
  const { theme, toggleTheme } = useTheme();
  const { handleSignOut, loading: signingOut, error: signOutError } = useSignOut(user.provider);

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const footerRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click / Escape so the menu does not block the rail.
  useEffect(() => {
    if (!userMenuOpen) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      if (footerRef.current && !footerRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setUserMenuOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("touchstart", onPointer, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("touchstart", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [userMenuOpen]);

  const displayName = (user.email?.split("@")[0] || "User").trim();
  const initials = displayName.slice(0, 1).toUpperCase();

  return (
    <nav
      data-sidebar-root
      aria-label="Primary"
      className="flex h-full w-[248px] shrink-0 flex-col overflow-hidden border-r border-border bg-bg-2 transition-[width] duration-200 ease-out"
    >
      {/* Brand row */}
      <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-border px-3">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label="Toggle sidebar"
          className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] bg-primary text-white"
          title="Toggle sidebar"
        >
          <span className="text-[10px] font-bold">AI</span>
        </button>
        <div data-sidebar-collapsible className="flex flex-1 items-center gap-2 overflow-hidden">
          <span className="truncate text-[13px] font-bold tracking-tight text-t1">AI-Native</span>
          <span className="rounded bg-bg-3 px-1.5 py-[2px] font-mono text-[9.5px] text-t3">v0.1</span>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Collapse sidebar"
            className="ml-auto flex h-[22px] w-[22px] items-center justify-center rounded-[5px] border border-border text-t3 hover:bg-bg-3 hover:text-t1 transition-colors"
            title="Collapse"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Fixed top: Overview + Framework section */}
      <div className="shrink-0 overflow-hidden p-1.5">
        <SidebarNavLink item={OVERVIEW_NAV} pathname={pathname} />
        <div className="my-1 h-px bg-border" data-sidebar-collapsible />
        <div data-sidebar-collapsible className="px-2 pt-1 pb-0.5">
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.13em] text-t3">
            Framework
          </span>
        </div>
        {FRAMEWORK_NAV.map((item) => (
          <SidebarNavLink key={item.id} item={item} pathname={pathname} />
        ))}
        <div className="my-1 h-px bg-border" />
        <div data-sidebar-collapsible className="flex items-center justify-between px-2 pt-1 pb-0.5">
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.13em] text-t3">
            Workflows
          </span>
          {/*
           * "+ New workflow" — opens the template editor. PR 12 wires the
           * actual editor route, but the link is in place so the affordance
           * is keyboard- and screen-reader-reachable today.
           */}
          <Link
            href="/workflows/templates/new"
            aria-label="New workflow"
            title="New workflow"
            data-testid="sidebar-new-workflow"
            className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border border-border text-t3 hover:border-accent hover:text-accent transition-colors"
          >
            <Plus className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Scrollable middle: workflow tree (templates + instances), or the
          dashed placeholder when no templates exist yet. */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1.5 py-1">
        <SidebarWorkflowTree
          templates={templates}
          instancesByTemplate={instancesByTemplate}
        />
      </div>

      {/* Fixed bottom: workspace nav */}
      <div className="shrink-0 overflow-hidden px-1.5 pb-1.5">
        <div className="my-1 h-px bg-border" />
        <div data-sidebar-collapsible className="px-2 pt-0.5 pb-0.5">
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.13em] text-t3">
            Workspace
          </span>
        </div>
        {WORKSPACE_NAV.map((item) => (
          <SidebarNavLink key={item.id} item={item} pathname={pathname} />
        ))}
      </div>

      {/* User footer */}
      <div ref={footerRef} className="relative shrink-0 border-t border-border p-2.5">
        <UserMenu
          open={userMenuOpen}
          onClose={() => setUserMenuOpen(false)}
          onThemeToggle={toggleTheme}
          onSignOut={() => {
            void handleSignOut();
          }}
          signingOut={signingOut}
          signOutError={signOutError}
          isDark={theme === "dark"}
        />
        <button
          type="button"
          data-sidebar-user
          onClick={() => setUserMenuOpen((prev) => !prev)}
          aria-haspopup="menu"
          aria-expanded={userMenuOpen}
          aria-label="Open user menu"
          className="flex w-full items-center gap-2 overflow-hidden rounded-lg p-2 hover:bg-bg-3 transition-colors"
        >
          <span
            aria-hidden
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-[11px] font-bold text-white"
          >
            {initials}
          </span>
          <span data-sidebar-collapsible className="flex flex-1 flex-col items-start overflow-hidden">
            <span className="truncate text-[12px] font-semibold text-t1">{displayName}</span>
            <span className="truncate font-mono text-[10px] text-t3">
              {user.email ?? "signed in"}
            </span>
          </span>
          <span data-sidebar-collapsible className="ml-auto flex h-3 w-3 items-center justify-center text-t3">
            <ChevronRight className="h-3 w-3" />
          </span>
        </button>
      </div>
    </nav>
  );
}

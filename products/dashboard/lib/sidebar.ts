"use client";

/**
 * Sidebar collapse runtime — client-only surface.
 *
 * The collapsed/expanded state is a UI preference that needs to (a) survive
 * route navigations within the SPA and (b) feel sticky across reloads.
 * `localStorage` is the persistence; this hook owns the in-memory store
 * and DOM `data-sidebar` attribute so both server-rendered chrome and
 * future siblings (top bar margins, future sidebar-aware widgets) can
 * react without each subscribing to its own snapshot.
 *
 * Mirrors the shape of `lib/theme.ts` on purpose so the two preferences
 * use the same `useSyncExternalStore` discipline. Without that, two
 * components calling the hook would each keep an independent snapshot,
 * drift after the first toggle, and silently diverge on the next call.
 */

import { useCallback, useSyncExternalStore } from "react";

export const SIDEBAR_STORAGE_KEY = "dashboard:sidebar_collapsed";
const DEFAULT_COLLAPSED = false;
const SSR_FALLBACK_COLLAPSED = false;

/**
 * Inline script body used by `RootLayout` to rehydrate the persisted
 * sidebar collapsed preference before paint, so the chrome does not
 * flicker from expanded to collapsed (or vice-versa) on reload.
 *
 * Pure string with no React/runtime references — safe to embed in a
 * Server Component via `dangerouslySetInnerHTML`.
 */
export const SIDEBAR_INIT_SCRIPT = `(() => {
  try {
    const stored = window.localStorage.getItem(${JSON.stringify(SIDEBAR_STORAGE_KEY)});
    const collapsed = stored === "true";
    document.documentElement.setAttribute(
      "data-sidebar",
      collapsed ? "collapsed" : "expanded"
    );
  } catch {
    document.documentElement.setAttribute("data-sidebar", "expanded");
  }
})();`;

function readDomCollapsed(): boolean {
  if (typeof document === "undefined") return SSR_FALLBACK_COLLAPSED;
  const attr = document.documentElement.getAttribute("data-sidebar");
  if (attr === "collapsed") return true;
  if (attr === "expanded") return false;

  try {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {
    // localStorage may be unavailable (sandboxed/quota); fall through to default.
  }

  return DEFAULT_COLLAPSED;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

function getServerSnapshot(): boolean {
  return SSR_FALLBACK_COLLAPSED;
}

function applyCollapsed(collapsed: boolean): void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute(
      "data-sidebar",
      collapsed ? "collapsed" : "expanded",
    );
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
    } catch {
      // Persisting is best-effort. The DOM attribute and in-memory state
      // remain authoritative for the session even if storage is blocked.
    }
  }
  emitChange();
}

/**
 * Read and write the sidebar collapsed state.
 *
 * All subscribers share one module-level store so a toggle from the user
 * footer is reflected immediately in the brand row's collapse button.
 */
export function useSidebarCollapsed(): {
  collapsed: boolean;
  setCollapsed: (next: boolean) => void;
  toggleCollapsed: () => void;
} {
  const collapsed = useSyncExternalStore(
    subscribe,
    readDomCollapsed,
    getServerSnapshot,
  );

  const setCollapsed = useCallback((next: boolean) => {
    applyCollapsed(next);
  }, []);

  const toggleCollapsed = useCallback(() => {
    applyCollapsed(!readDomCollapsed());
  }, []);

  return { collapsed, setCollapsed, toggleCollapsed };
}

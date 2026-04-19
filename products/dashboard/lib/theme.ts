"use client";

/**
 * Theme runtime helpers.
 *
 * The dashboard ships dark-first: server renders `<html data-theme="dark">`
 * and an inline pre-paint script in `app/layout.tsx` rehydrates the user's
 * persisted preference before first paint to avoid a theme flash. This
 * module is the canonical client-side surface for reading and writing that
 * preference.
 *
 * State is centralised in a module-level subscriber set so every
 * `useTheme()` consumer (current or future) sees the same value. Without
 * that, two components calling the hook would each keep an independent
 * `useState` snapshot, drift after the first toggle, and silently flip the
 * wrong way on the next call. `useSyncExternalStore` keeps the React
 * renders coherent across all subscribers.
 */

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

export const DEFAULT_THEME: Theme = "dark";

/** localStorage key used to persist the user's theme preference. */
export const THEME_STORAGE_KEY = "theme";

/** Inline script body used by `RootLayout` to rehydrate the persisted theme before paint. */
export const THEME_INIT_SCRIPT = `(() => {
  try {
    const stored = window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    const theme = stored === "light" || stored === "dark" ? stored : ${JSON.stringify(DEFAULT_THEME)};
    document.documentElement.setAttribute("data-theme", theme);
  } catch {
    document.documentElement.setAttribute("data-theme", ${JSON.stringify(DEFAULT_THEME)});
  }
})();`;

function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light";
}

function readDomTheme(): Theme {
  if (typeof document === "undefined") return DEFAULT_THEME;
  const attr = document.documentElement.getAttribute("data-theme");
  return isTheme(attr) ? attr : DEFAULT_THEME;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitThemeChange(): void {
  listeners.forEach((listener) => listener());
}

function getServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

function applyTheme(theme: Theme): void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Persisting is best-effort. A sandboxed browser, full storage
      // quota, or privacy mode still gets a working theme — the in-memory
      // state and DOM attribute are authoritative for the session.
    }
  }
  emitThemeChange();
}

/**
 * Read and write the active theme.
 *
 * All subscribers share one module-level store, so an update from any
 * consumer is reflected in every other consumer's next render.
 */
export function useTheme(): {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
} {
  const theme = useSyncExternalStore(subscribe, readDomTheme, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    applyTheme(readDomTheme() === "dark" ? "light" : "dark");
  }, []);

  return { theme, setTheme, toggleTheme };
}

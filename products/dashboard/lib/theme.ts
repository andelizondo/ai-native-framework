"use client";

/**
 * Theme runtime — client-only surface.
 *
 * The dashboard ships dark-first: the server renders
 * `<html data-theme="dark">` and an inline pre-paint script in
 * `app/layout.tsx` rehydrates the user's persisted preference before first
 * paint to avoid a theme flash. This module owns the client-side hook.
 *
 * Server Components that only need the constants or the inline init
 * script must import from `lib/theme-tokens.ts` instead, so they do not
 * cross the client boundary that `"use client"` defines here.
 *
 * State is centralised in a module-level subscriber set so every
 * `useTheme()` consumer (current or future) sees the same value. Without
 * that, two components calling the hook would each keep an independent
 * snapshot, drift after the first toggle, and silently flip the wrong way
 * on the next call. `useSyncExternalStore` keeps the React renders
 * coherent across all subscribers.
 *
 * When the preference is "system", a `matchMedia` listener fires whenever
 * `prefers-color-scheme` changes and the app updates immediately without a
 * page reload.
 */

import { useCallback, useSyncExternalStore } from "react";

import {
  DEFAULT_PREFERENCE,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  type Theme,
  type ThemePreference,
} from "./theme-tokens";

function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light";
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "dark" || value === "light" || value === "system";
}

function getSystemTheme(): Theme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return DEFAULT_THEME;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readDomTheme(): Theme {
  if (typeof document === "undefined") return DEFAULT_THEME;
  const attr = document.documentElement.getAttribute("data-theme");
  return isTheme(attr) ? attr : DEFAULT_THEME;
}

function readPreference(): ThemePreference {
  if (typeof window === "undefined") return DEFAULT_PREFERENCE;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : DEFAULT_PREFERENCE;
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

function resolveTheme(pref: ThemePreference): Theme {
  return pref === "system" ? getSystemTheme() : pref;
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

// Keep the DOM in sync when the OS preference changes and the user has chosen "system".
if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (readPreference() === "system") {
        const resolved = getSystemTheme();
        document.documentElement.setAttribute("data-theme", resolved);
        emitThemeChange();
      }
    });
}

function getServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

function applyPreference(pref: ThemePreference): void {
  const resolved = resolveTheme(pref);
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", resolved);
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, pref);
    } catch {
      // Persisting is best-effort. A sandboxed browser, full storage
      // quota, or privacy mode still gets a working theme — the in-memory
      // state and DOM attribute are authoritative for the session.
    }
  }
  emitThemeChange();
}

/**
 * Read and write the active theme preference.
 *
 * - `theme` — the resolved effective theme ("dark" | "light") applied to the DOM.
 * - `preference` — the stored preference ("dark" | "light" | "system").
 * - `setPreference` — update the preference; "system" follows the OS in real-time.
 *
 * All subscribers share one module-level store, so an update from any
 * consumer is reflected in every other consumer's next render.
 */
export function useTheme(): {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
} {
  const theme = useSyncExternalStore(subscribe, readDomTheme, getServerSnapshot);
  const preference = useSyncExternalStore(subscribe, readPreference, () => DEFAULT_PREFERENCE);

  const setPreference = useCallback((pref: ThemePreference) => {
    applyPreference(pref);
  }, []);

  return { theme, preference, setPreference };
}

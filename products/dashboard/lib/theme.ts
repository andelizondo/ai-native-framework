"use client";

/**
 * Theme runtime helpers.
 *
 * The dashboard ships dark-first: server renders `<html data-theme="dark">`
 * and an inline pre-paint script in `app/layout.tsx` rehydrates the user's
 * persisted preference before first paint to avoid a theme flash. This
 * module is the canonical client-side surface for reading and writing that
 * preference.
 */

import { useCallback, useEffect, useState } from "react";

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

function applyTheme(theme: Theme): void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Persisting is best-effort. A sandboxed/full storage quota or a
      // privacy-mode browser still gets a working theme — the in-memory
      // state and DOM attribute are authoritative for the session.
    }
  }
}

/**
 * Read and write the active theme.
 *
 * The hook starts with `DEFAULT_THEME` to keep server and first client
 * render aligned with the static `<html data-theme="dark">` markup, then
 * syncs with whatever the pre-paint script applied on the client.
 */
export function useTheme(): {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
} {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    setThemeState(readDomTheme());
  }, []);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  }, []);

  return { theme, setTheme, toggleTheme };
}

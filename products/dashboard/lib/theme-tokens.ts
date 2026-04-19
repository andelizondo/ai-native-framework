/**
 * Theme tokens — server-safe surface.
 *
 * These constants are imported by both the Server Component root layout
 * (`app/layout.tsx`) and the client-only `useTheme()` hook in `lib/theme.ts`.
 * Keeping them in a module with no `"use client"` directive avoids forcing
 * the layout across a client boundary just to read a couple of strings.
 *
 * Do not add browser- or React-only code here. Anything that touches
 * `document`, `window`, `localStorage`, or React hooks belongs in
 * `lib/theme.ts`.
 */

export type Theme = "dark" | "light";

export const DEFAULT_THEME: Theme = "dark";

/** localStorage key used to persist the user's theme preference. */
export const THEME_STORAGE_KEY = "theme";

/**
 * Inline script body used by `RootLayout` to rehydrate the persisted theme
 * before paint. Pure string — safe to embed in a Server Component.
 */
export const THEME_INIT_SCRIPT = `(() => {
  try {
    const stored = window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    const theme = stored === "light" || stored === "dark" ? stored : ${JSON.stringify(DEFAULT_THEME)};
    document.documentElement.setAttribute("data-theme", theme);
  } catch {
    document.documentElement.setAttribute("data-theme", ${JSON.stringify(DEFAULT_THEME)});
  }
})();`;

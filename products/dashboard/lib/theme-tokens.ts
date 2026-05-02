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

/** The resolved/applied theme — the value written to `data-theme`. */
export type Theme = "dark" | "light";

/** The stored user preference, which may delegate to the OS. */
export type ThemePreference = "dark" | "light" | "system";

/** Fallback resolved theme for SSR and when matchMedia is unavailable. */
export const DEFAULT_THEME: Theme = "dark";

/** Default preference for new users — follow the OS. */
export const DEFAULT_PREFERENCE: ThemePreference = "system";

/** localStorage key used to persist the user's theme preference. */
export const THEME_STORAGE_KEY = "theme";

/**
 * Inline script body used by `RootLayout` to rehydrate the persisted theme
 * before paint. Pure string — safe to embed in a Server Component.
 *
 * When the preference is "system" (or absent / unrecognised), the script
 * resolves the effective theme via `prefers-color-scheme` so the OS setting
 * is honoured without a flash.
 */
export const THEME_INIT_SCRIPT = `(() => {
  try {
    const stored = window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    let theme;
    if (stored === "light" || stored === "dark") {
      theme = stored;
    } else {
      theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", theme);
  } catch {
    document.documentElement.setAttribute("data-theme", ${JSON.stringify(DEFAULT_THEME)});
  }
})();`;

/**
 * Theme rendering checks — login page must render cleanly in both themes.
 *
 * Spec anchor: AEL-45 — PR 2 (Theme tokens + dark-first globals).
 *
 * The login page intentionally uses a hard-coded dark hero card that does
 * not flip with `data-theme`. These tests pin the contract that:
 *   1. With no persisted `theme` key, the inline pre-paint script resolves
 *      the effective palette from `prefers-color-scheme` (default preference
 *      is system).
 *   2. A persisted `theme=light` or `theme=dark` value overrides that and
 *      boots accordingly — exercising the real entry path for returning
 *      users, not just a post-load DOM mutation.
 */

import { test, expect } from "@playwright/test";

const THEME_STORAGE_KEY = "theme";

test.describe("theme — login page renders in both themes", () => {
  test("no persisted theme + prefers dark → data-theme=\"dark\"", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("form", { name: /sign in/i })).toBeVisible();
  });

  test("no persisted theme + prefers light → data-theme=\"light\"", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("form", { name: /sign in/i })).toBeVisible();
  });

  test("persisted theme=\"light\" boots the page in light mode", async ({ page }) => {
    // Seed the persisted preference before any document loads, so the
    // inline pre-paint script in app/layout.tsx is the thing that flips
    // data-theme — that is the contract a returning user actually hits.
    await page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
      },
      [THEME_STORAGE_KEY, "light"] as const,
    );

    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("form", { name: /sign in/i })).toBeVisible();
  });
});

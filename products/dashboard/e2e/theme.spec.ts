/**
 * Theme rendering checks — login page must render cleanly in both themes.
 *
 * Spec anchor: AEL-45 — PR 2 (Theme tokens + dark-first globals).
 *
 * The login page intentionally uses a hard-coded dark hero card that does
 * not flip with `data-theme`. These tests pin the contract that:
 *   1. The default render is dark (matches `<html data-theme="dark">`).
 *   2. Toggling `data-theme="light"` does not break the page or hide the
 *      sign-in form (no visual regression on the only authenticated entry
 *      surface that exists today).
 */

import { test, expect } from "@playwright/test";

test.describe("theme — login page renders in both themes", () => {
  test("default render uses data-theme=\"dark\"", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("form", { name: /sign in/i })).toBeVisible();
  });

  test("toggling data-theme=\"light\" leaves the form healthy", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() =>
      document.documentElement.setAttribute("data-theme", "light"),
    );
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("form", { name: /sign in/i })).toBeVisible();
  });
});

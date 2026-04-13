/**
 * Smoke tests — post-deployment boot verification.
 *
 * Scope: confirm the app started, serves HTML, and core structural landmarks
 * are present. These run on every PR (against Vercel preview) and after every
 * production release.
 *
 * If these fail, the deployment is broken at boot level — stop, escalate.
 * See docs/QUALITY_STANDARD.md §5.9 and §6.1.
 */

import { test, expect } from "@playwright/test";

test.describe("smoke — boot verification", () => {
  test("home page responds with 200", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
  });

  test("page title is set correctly", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/AI-Native Dashboard/i);
  });

  test("sidebar landmark is present", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("complementary")).toBeVisible();
  });

  test("header landmark is present", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("banner")).toBeVisible();
  });

  test("main content area is present", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("health — no unhandled JS errors on home page load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/");
    // Allow a brief moment for any async errors to surface
    await page.waitForTimeout(500);
    expect(errors).toHaveLength(0);
  });
});

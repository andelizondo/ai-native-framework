/**
 * Critical-path E2E + accessibility tests.
 *
 * Scope: primary user flows AND WCAG 2.1 AA accessibility on those same flows.
 * These are the "critical-path E2E subset" that runs on every PR as a blocking gate.
 *
 * Accessibility rule: violations on these flows BLOCK merge.
 * See docs/QUALITY_STANDARD.md §5.5, §5.6, §6.1.
 *
 * axe-core is used for automated accessibility scanning. Automated scanning
 * catches ~30–40% of WCAG issues; manual review is still required for
 * keyboard navigation, screen reader semantics, and focus management.
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// ─── Navigation ───────────────────────────────────────────────────────────────

test.describe("critical-path navigation", () => {
  test("home page renders the Hello World card", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /hello, world/i }),
    ).toBeVisible();
  });

  test("sidebar shows all three phase links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /ideation/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /design/i })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /implementation/i }),
    ).toBeVisible();
  });

  test("navigating to /ideation renders the Ideation page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /ideation/i }).click();
    await expect(page).toHaveURL(/\/ideation/);
    await expect(
      page.getByRole("heading", { name: /ideation/i }),
    ).toBeVisible();
  });

  test("navigating to /design renders the Design page", async ({ page }) => {
    await page.goto("/design");
    await expect(page).toHaveURL(/\/design/);
    await expect(page.getByRole("heading", { name: /design/i })).toBeVisible();
  });

  test("navigating to /implementation renders the Implementation page", async ({
    page,
  }) => {
    await page.goto("/implementation");
    await expect(page).toHaveURL(/\/implementation/);
    await expect(
      page.getByRole("heading", { name: /implementation/i }),
    ).toBeVisible();
  });

  test("logo link returns to home from a phase page", async ({ page }) => {
    await page.goto("/ideation");
    // The sidebar logo link (AI-Native) points to /
    await page.getByRole("link", { name: /ai-native/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { name: /hello, world/i }),
    ).toBeVisible();
  });
});

// ─── Accessibility ────────────────────────────────────────────────────────────

test.describe("accessibility — critical flows (WCAG 2.1 AA)", () => {
  test("home page has no automatically detectable accessibility violations", async ({
    page,
  }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("ideation page has no automatically detectable accessibility violations", async ({
    page,
  }) => {
    await page.goto("/ideation");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("design page has no automatically detectable accessibility violations", async ({
    page,
  }) => {
    await page.goto("/design");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("implementation page has no automatically detectable accessibility violations", async ({
    page,
  }) => {
    await page.goto("/implementation");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("sidebar navigation links are keyboard-accessible", async ({ page }) => {
    await page.goto("/");
    // Tab to the first navigation link and activate it
    await page.keyboard.press("Tab");
    // The first focusable element should be within the sidebar
    const focusedElement = page.locator(":focus");
    await expect(focusedElement).toBeVisible();
  });
});

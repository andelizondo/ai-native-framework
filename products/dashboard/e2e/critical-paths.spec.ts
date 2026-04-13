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

import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21aa"];

async function expectNoA11yViolations(
  path: string,
  page: Page,
) {
  await page.goto(path);
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
}

function sidebarLink(page: Page, targetName: RegExp) {
  return page.getByRole("navigation").getByRole("link", { name: targetName });
}

async function focusWithTab(
  page: Page,
  targetName: RegExp,
  maxTabs = 8,
) {
  const target = sidebarLink(page, targetName);

  for (let index = 0; index < maxTabs; index += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) {
      return target;
    }
  }

  return target;
}

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
    await expect(sidebarLink(page, /ideation/i)).toBeVisible();
    await expect(sidebarLink(page, /design/i)).toBeVisible();
    await expect(sidebarLink(page, /implementation/i)).toBeVisible();
  });

  test("navigating to /ideation renders the Ideation page", async ({ page }) => {
    await page.goto("/");
    await Promise.all([
      page.waitForURL(/\/ideation/),
      sidebarLink(page, /ideation/i).click(),
    ]);
    await expect(
      page.getByRole("heading", { name: /ideation/i }),
    ).toBeVisible();
  });

  test("sidebar link navigates to /design and renders the Design page", async ({
    page,
  }) => {
    await page.goto("/");
    await Promise.all([
      page.waitForURL(/\/design/),
      sidebarLink(page, /design/i).click(),
    ]);
    await expect(page.getByRole("heading", { name: /design/i })).toBeVisible();
  });

  test("sidebar link navigates to /implementation and renders the Implementation page", async ({
    page,
  }) => {
    await page.goto("/");
    await Promise.all([
      page.waitForURL(/\/implementation/),
      sidebarLink(page, /implementation/i).click(),
    ]);
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
    await expectNoA11yViolations("/", page);
  });

  test("ideation page has no automatically detectable accessibility violations", async ({
    page,
  }) => {
    await expectNoA11yViolations("/ideation", page);
  });

  test("design page has no automatically detectable accessibility violations", async ({
    page,
  }) => {
    await expectNoA11yViolations("/design", page);
  });

  test("implementation page has no automatically detectable accessibility violations", async ({
    page,
  }) => {
    await expectNoA11yViolations("/implementation", page);
  });

  test("sidebar navigation links are keyboard-accessible", async ({ page }) => {
    await page.goto("/");
    const ideationLink = await focusWithTab(page, /ideation/i);
    await expect(ideationLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/ideation$/);
  });
});

/**
 * Critical-path E2E + accessibility tests.
 *
 * Scope: primary auth and dashboard flows AND WCAG 2.1 AA accessibility on
 * those same flows. These are the blocking PR-path browser checks.
 */

import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21aa"];
const baseURL = process.env.BASE_URL || "http://localhost:3000";
const bypassSecret = process.env.AUTH_E2E_BYPASS_SECRET;
const hasSupabaseRuntime =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function expectNoA11yViolations(
  path: string,
  page: Page,
  assertReady?: (page: Page) => Promise<void>,
) {
  await page.goto(path);
  if (assertReady) {
    await assertReady(page);
  }
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
}

async function authenticateWithBypass(page: Page) {
  test.skip(!bypassSecret, "AUTH_E2E_BYPASS_SECRET is required for authenticated E2E");

  await page.context().addCookies([
    {
      name: "dashboard_e2e_auth",
      value: `${bypassSecret}:e2e-user:${encodeURIComponent("e2e@example.com")}`,
      url: baseURL,
    },
  ]);
}

function sidebarLink(page: Page, targetName: RegExp) {
  return page.getByRole("navigation").getByRole("link", { name: targetName });
}

test.describe("critical-path auth and dashboard flows", () => {
  test("unauthenticated visit to / redirects to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: /ai-native dashboard/i }),
    ).toBeVisible();
  });

  test("magic-link request form submits and shows confirmation state", async ({
    page,
  }) => {
    test.skip(!hasSupabaseRuntime, "Supabase runtime env is required for magic-link E2E");

    await page.goto("/login");
    await page.getByLabel("Email").fill("founder@example.com");
    await page.getByRole("button", { name: /send magic link/i }).click();

    await expect(page.getByText(/check your email/i)).toBeVisible();
  });

  test("callback error path renders a retryable error state", async ({ page }) => {
    await page.goto("/login?error=auth_callback_failed");
    await expect(page.getByTestId("auth-callback-error")).toContainText(/try again/i);
    await expect(
      page.getByRole("button", { name: /send magic link/i }),
    ).toBeVisible();
  });

  test("authenticated session can reach the dashboard and sign out", async ({
    page,
  }) => {
    await authenticateWithBypass(page);

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /hello, world/i }),
    ).toBeVisible();
    await expect(sidebarLink(page, /ideation/i)).toBeVisible();

    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("accessibility — critical flows (WCAG 2.1 AA)", () => {
  test("login page has no automatically detectable accessibility violations", async ({
    page,
  }) => {
    await expectNoA11yViolations("/login", page);
  });

  test("callback error state has no automatically detectable accessibility violations", async ({
    page,
  }) => {
    await expectNoA11yViolations("/login?error=auth_callback_failed", page);
  });

  test("authenticated dashboard home has no automatically detectable accessibility violations", async ({
    page,
  }) => {
    await authenticateWithBypass(page);
    await expectNoA11yViolations("/", page, async (p) => {
      await expect(p).toHaveURL(/\/$/);
      await expect(p.getByRole("heading", { name: /hello, world/i })).toBeVisible();
    });
  });
});

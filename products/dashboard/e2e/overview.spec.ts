/**
 * E2E coverage for AEL-49 — Overview screen with real data.
 *
 * Mirrors the bypass + Supabase-runtime guard pattern in
 * `e2e/workflows.spec.ts`: a CI runner without the auth bypass cookie
 * or live Supabase credentials skips these checks rather than failing.
 * The expectations encode the AEL-49 acceptance criteria so any
 * regression on a fully-credentialed runner trips immediately.
 */

import { test, expect, type Page } from "@playwright/test";

const baseURL = process.env.BASE_URL || "http://localhost:3000";
const bypassSecret = process.env.AUTH_E2E_BYPASS_SECRET;
const hasSupabaseRuntime =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function authenticateWithBypass(page: Page) {
  test.skip(
    !bypassSecret,
    "AUTH_E2E_BYPASS_SECRET is required for authenticated E2E",
  );

  await page.context().addCookies([
    {
      name: "dashboard_e2e_auth",
      value: `${bypassSecret}:e2e-user:${encodeURIComponent("e2e@example.com")}`,
      url: baseURL,
    },
  ]);
}

test.describe("overview — live workflow data", () => {
  test("renders greeting, stat cards, and process-health chips that navigate", async ({
    page,
  }) => {
    test.skip(
      !hasSupabaseRuntime,
      "Supabase runtime credentials required for the Overview happy path",
    );

    await authenticateWithBypass(page);
    await page.goto("/");

    // Greeting is always rendered, even when the workspace is empty.
    await expect(page.getByTestId("overview-greeting")).toBeVisible();

    // Four stat cards present, each with a numeric value (zero is fine
    // for an empty workspace; the contract is "they render", not "they
    // are non-zero", since seed state varies per environment).
    const stats = page.getByTestId("overview-stats");
    await expect(stats).toBeVisible();
    await expect(stats).toContainText(/Active instances/);
    await expect(stats).toContainText(/My tasks/);
    await expect(stats).toContainText(/Active tasks/);
    await expect(stats).toContainText(/Completion/);

    // Process Health card is always present; chips are conditional on
    // there being at least one instance in the workspace.
    await expect(page.getByTestId("overview-process-health")).toBeVisible();

    const firstChip = page
      .locator('[data-testid^="overview-instance-chip-"]')
      .first();

    if (await firstChip.count()) {
      const href = await firstChip.getAttribute("href");
      expect(href).toMatch(/^\/workflows\/[^/]+$/);
      await firstChip.click();
      await expect(page).toHaveURL(/\/workflows\/[^/]+$/);
    }
  });
});

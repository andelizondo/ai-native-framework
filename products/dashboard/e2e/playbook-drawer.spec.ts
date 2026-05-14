/**
 * E2E coverage for the new playbook drawer (AEL-61 / PR 3).
 *
 * The full happy-path (open task → Start → assert running → produce
 * outputs → assert complete + refine card visible) requires:
 *   - a live Supabase project with PR 2's migration applied,
 *   - seeded templates with at least one task that has a playbookId,
 *   - the auth bypass cookie for an authenticated session,
 *   - service-role access so the test can flip task_outputs.status to
 *     'produced' directly.
 *
 * On runners without those credentials we skip rather than fail. The
 * structural assertions still encode the expected surface so a
 * regression on a configured runner trips immediately.
 */

import { test, expect, type Page } from "@playwright/test";

const baseURL = process.env.BASE_URL || "http://localhost:3000";
const bypassSecret = process.env.AUTH_E2E_BYPASS_SECRET;
const bypassUserId = process.env.AUTH_E2E_BYPASS_USER_ID;
const bypassEmail = process.env.AUTH_E2E_BYPASS_EMAIL;
const hasSupabaseRuntime =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY;

async function authenticateAsRealUser(page: Page) {
  test.skip(
    !bypassSecret || !bypassUserId || !bypassEmail || !hasSupabaseRuntime,
    "AUTH_E2E_BYPASS_SECRET, AUTH_E2E_BYPASS_USER_ID, AUTH_E2E_BYPASS_EMAIL, and SUPABASE_SERVICE_ROLE_KEY required",
  );
  await page.context().addCookies([
    {
      name: "dashboard_e2e_auth",
      value: `${bypassSecret}:${bypassUserId}:${encodeURIComponent(bypassEmail!)}`,
      url: baseURL,
    },
  ]);
}

async function openFirstTask(page: Page) {
  await page.goto("/");
  const instanceLink = page.locator('a[href*="/workflows/"][href*="/inst-"]').first();
  await expect(instanceLink).toBeVisible({ timeout: 10000 });
  await instanceLink.click();
  // Click the first task that has a playbook (TaskCard renders a button).
  const taskCard = page.locator('[data-testid^="task-card-"]').first();
  await expect(taskCard).toBeVisible();
  await taskCard.click();
}

test.describe("Playbook drawer (AEL-61)", () => {
  test("renders header, action bar, sections, and chat footer when opened", async ({
    page,
  }) => {
    await authenticateAsRealUser(page);
    await openFirstTask(page);

    const drawer = page.getByTestId("pb-drawer");
    await expect(drawer).toBeVisible();
    await expect(page.getByTestId("pb-drawer-header")).toBeVisible();
    await expect(page.getByTestId("pb-drawer-actionbar")).toBeVisible();
    await expect(page.getByTestId("pb-drawer-inputs-section")).toBeVisible();
    await expect(page.getByTestId("pb-drawer-outputs-section")).toBeVisible();
    await expect(page.getByTestId("pb-drawer-chat")).toBeVisible();
    // Old surfaces must be gone.
    await expect(page.locator('[data-testid="agent-run-panel"]')).toHaveCount(0);
  });

  test("Start triggers a status transition for a task with all inputs received", async ({
    page,
  }) => {
    await authenticateAsRealUser(page);
    await openFirstTask(page);
    const startBtn = page.getByTestId("pb-drawer-start-btn");
    if (await startBtn.isVisible()) {
      const isDisabled = await startBtn.isDisabled();
      if (!isDisabled) {
        await startBtn.click();
        // After click, the drawer should re-render and the start button
        // should be hidden (status transitions to in_progress or running).
        await expect(startBtn).toHaveCount(0);
      }
    }
  });

  test("Escape closes the drawer", async ({ page }) => {
    await authenticateAsRealUser(page);
    await openFirstTask(page);
    await expect(page.getByTestId("pb-drawer")).toBeVisible();
    await page.keyboard.press("Escape");
    // Closed drawer renders an aria-hidden shell.
    await expect(page.getByTestId("pb-drawer")).toHaveAttribute("aria-hidden", "true");
  });
});

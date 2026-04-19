/**
 * E2E coverage for AEL-48 — workflow tree + create-instance modal.
 *
 * The full happy-path (open modal → type label → create → see in sidebar
 * → land on instance route) requires a live Supabase project with the
 * PR 4 migration applied AND seeded templates AND the auth bypass cookie
 * for an authenticated session. CI environments without those credentials
 * skip the test rather than fail it; the test still encodes the expected
 * surface so any regression on a runner that does have credentials trips
 * immediately.
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

test.describe("workflows — create-instance modal", () => {
  test("opens the modal, creates a new instance, and lands on the matrix route", async ({
    page,
  }) => {
    test.skip(
      !hasSupabaseRuntime,
      "Supabase runtime credentials required for the workflow tree happy path",
    );

    await authenticateWithBypass(page);
    await page.goto("/");

    // Sidebar workflow tree should expose at least one template seeded by
    // PR 4. Click the "+ New instance" trigger for the first template
    // present in the tree.
    const newInstance = page
      .locator('[data-testid^="workflow-new-instance-"]')
      .first();
    await expect(newInstance).toBeVisible();
    await newInstance.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Create button is disabled until the user types a non-empty label.
    const createBtn = dialog.getByRole("button", { name: /^create\s*→?$/i });
    await expect(createBtn).toBeDisabled();

    const uniqueLabel = `E2E Acme ${Date.now()}`;
    await dialog.getByRole("textbox", { name: /instance name/i }).fill(uniqueLabel);
    await expect(createBtn).toBeEnabled();

    await createBtn.click();

    // The modal closes, the user lands on /workflows/{id}, and the
    // sidebar reflects the new instance.
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/workflows\/[0-9a-f-]+$/);
    await expect(
      page.getByRole("heading", { name: uniqueLabel }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: new RegExp(uniqueLabel) }),
    ).toBeVisible();
  });
});

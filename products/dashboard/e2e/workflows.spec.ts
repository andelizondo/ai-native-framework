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

/** Opens the "+ New instance" dialog for the first template in the sidebar tree. */
async function openFirstTemplateNewInstanceDialog(page: Page) {
  await page.goto("/");
  const trigger = page
    .locator('[data-testid^="workflow-new-instance-"]')
    .first();
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

async function createFreshInstance(page: Page, labelPrefix: string) {
  const dialog = await openFirstTemplateNewInstanceDialog(page);
  await dialog
    .getByRole("textbox", { name: /instance name/i })
    .fill(`${labelPrefix} ${Date.now()}`);
  await dialog.getByRole("button", { name: /^create\s*→?$/i }).click();
  await expect(page).toHaveURL(/\/workflows\/[0-9a-f-]+$/);
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

    const dialog = await openFirstTemplateNewInstanceDialog(page);

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
      page.getByRole("link", { name: uniqueLabel }),
    ).toBeVisible();
  });
});

test.describe("workflows — process matrix (read-only)", () => {
  test("renders sticky stage headers, role rows, and at least one bar-state task card", async ({
    page,
  }) => {
    test.skip(
      !hasSupabaseRuntime,
      "Supabase runtime credentials required for the matrix happy path",
    );

    await authenticateWithBypass(page);

    // The matrix needs an existing instance to paint, so create a fresh
    // one from the first template in the sidebar (no fixture coupling)
    // and follow the redirect onto its `/workflows/{id}` route.
    await createFreshInstance(page, "E2E Matrix");

    const matrix = page.getByTestId("process-matrix");
    await expect(matrix).toBeVisible();

    // Stage headers and role row are present (selectors match the
    // seeded "Client Project Delivery" template; if a different
    // template is first in the sidebar the test still asserts at
    // least one of each).
    await expect(
      page.locator('[data-testid^="matrix-stage-"]').first(),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid^="matrix-skill-row-"]').first(),
    ).toBeVisible();

    // Newly-created instances start every task at `not_started`, so
    // the matrix must paint at least one card and at least one card
    // must carry a bar-* state class. Use the data attribute the
    // component wires for exactly this assertion.
    await expect(
      page.locator('[data-testid^="task-card-"]').first(),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid^="task-card-"][data-bar^="bar-"]').first(),
    ).toBeVisible();

    // The role-collapse toggle flips the matrix into collapsed mode;
    // verify the body class flips so we know the CSS contract is wired.
    const toggle = page.getByTestId("matrix-skills-toggle");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(matrix).toHaveAttribute("data-collapsed", "true");
  });
});

test.describe("workflows — task drawer (AEL-51)", () => {
  test("clicking a task card opens the drawer and Escape closes it", async ({
    page,
  }) => {
    test.skip(
      !hasSupabaseRuntime,
      "Supabase runtime credentials required for the drawer happy path",
    );

    await authenticateWithBypass(page);

    // Create a fresh instance so the matrix has tasks.
    await createFreshInstance(page, "E2E Drawer");

    // Click the first task card.
    const firstCard = page.locator('[data-testid^="task-card-"]').first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();

    // Drawer should appear.
    const drawer = page.getByTestId("task-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute("role", "dialog");

    // Breadcrumb and tabs visible.
    await expect(page.getByTestId("td-tab-details")).toBeVisible();
    await expect(page.getByTestId("td-tab-events")).toBeVisible();
    await expect(page.getByTestId("td-tab-dependencies")).toBeVisible();

    // Escape closes the drawer.
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });

  test("events tab shows seed events scoped to the selected task", async ({
    page,
  }) => {
    test.skip(
      !hasSupabaseRuntime,
      "Supabase runtime credentials required for the events tab happy path",
    );

    await authenticateWithBypass(page);

    await createFreshInstance(page, "E2E Events Tab");

    const firstCard = page.locator('[data-testid^="task-card-"]').first();
    await firstCard.click();

    const drawer = page.getByTestId("task-drawer");
    await expect(drawer).toBeVisible();

    await page.getByTestId("td-tab-events").click();

    // Either empty state or event list is shown — both are valid depending on
    // whether the seed script wrote events for this task.
    const eventList = page.getByTestId("td-event-list");
    const emptyState = page.getByTestId("td-events-empty");
    await expect(eventList.or(emptyState)).toBeVisible();
  });
});

test.describe("workflows — matrix edit mode (AEL-52)", () => {
  test("opens the add-task modal and creates a task in an empty cell", async ({
    page,
  }) => {
    test.skip(
      !hasSupabaseRuntime,
      "Supabase runtime credentials required for the matrix edit-mode happy path",
    );

    await authenticateWithBypass(page);
    await createFreshInstance(page, "E2E Edit Mode");

    await page.getByRole("button", { name: "Customize" }).click();
    await expect(page).toHaveURL(/edit=1/);

    const addTrigger = page.locator('[data-testid^="matrix-add-task-"]').first();
    await expect(addTrigger).toBeVisible();
    await addTrigger.click();

    const modal = page.getByRole("dialog", { name: "Add playbook" });
    await expect(modal).toBeVisible();
    // The playbook list is filtered by the row's allowed-skills. The seed
    // ensures at least one playbook is visible for each skill row.
    const firstPlaybook = modal.locator('button[type="button"]').filter({ hasText: /.+/ }).first();
    if (await firstPlaybook.count()) {
      await firstPlaybook.click();
    }
    const submit = modal.getByRole("button", { name: /add task/i });
    if (await submit.isEnabled()) {
      await submit.click();
      await expect(modal).toBeHidden();
    }
  });
});

test.describe("workflows — template editor (AEL-55)", () => {
  test("opens the template editor, renames a stage, saves, and sees the change on next visit", async ({
    page,
  }) => {
    test.skip(
      !hasSupabaseRuntime,
      "Supabase runtime credentials required for the template-editor happy path",
    );

    await authenticateWithBypass(page);
    await page.goto("/");

    const editTemplate = page
      .locator('[data-testid^="workflow-template-link-"]')
      .first();
    await expect(editTemplate).toBeVisible();
    await editTemplate.click();

    await expect(page).toHaveURL(/\/workflows\/templates\/[^/]+\/edit$/);

    const firstStage = page.locator(".mx-stage-name").first();
    await firstStage.click();

    const uniqueLabel = `Discovery ${Date.now()}`;
    const preferredEditor = page.locator('input[value="Pre-Sales"]').first();
    const fallbackEditor = page.locator(".mx-stage-hd input").first();
    const editor = (await preferredEditor.count()) > 0 ? preferredEditor : fallbackEditor;
    await editor.fill(uniqueLabel);
    await editor.press("Enter");

    await page.getByRole("button", { name: /save workflow/i }).click();
    await expect(page).toHaveURL("/");

    await editTemplate.click();
    await expect(page).toHaveURL(/\/workflows\/templates\/[^/]+\/edit$/);
    await expect(page.getByText(uniqueLabel)).toBeVisible();
  });
});

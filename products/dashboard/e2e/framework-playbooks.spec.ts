import { expect, test, type Page } from "@playwright/test";

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

test.describe("framework playbooks", () => {
  test("loads seed data, creates a playbook, edits it, and deletes it", async ({ page }) => {
    test.skip(
      !hasSupabaseRuntime,
      "Supabase runtime credentials required for the framework playbooks happy path",
    );

    await authenticateWithBypass(page);
    await page.goto("/framework/playbooks");

    await expect(page.getByTestId("framework-screen-playbook")).toBeVisible();
    await expect(page.getByTestId("framework-grid-playbook")).toContainText("Presales Qualification");

    const playbookName = `E2E Playbook ${Date.now()}`;
    const playbookDescription = "Created by Playwright";
    const renamedPlaybook = `${playbookName} Revised`;
    const revisedDescription = "Sharper and more polished from Playwright";
    const savedContent = `# ${renamedPlaybook}\n\n## Objective\n\nSaved from Playwright.`;

    await page.getByRole("button", { name: "New playbook" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Title").fill(playbookName);
    await page.getByLabel("Description").fill(playbookDescription);
    await page.getByRole("button", { name: "Create" }).click();

    await expect(page.getByTestId("framework-markdown-preview-playbook")).toBeVisible();
    await page.getByRole("button", { name: "Rename playbook" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Title").fill(renamedPlaybook);
    await page.getByLabel("Description").fill(revisedDescription);
    await page.getByRole("button", { name: "Apply" }).click();

    await page.getByLabel("Change icon").click();
    await page.getByLabel("Search or type emoji").fill("📚");
    await page.getByRole("button", { name: "Use typed emoji" }).click();
    await page.getByRole("tab", { name: "Edit" }).click();

    const editor = page.getByTestId("framework-editor-playbook");
    await editor.fill(savedContent);
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.status() === 200 &&
          response.url().includes("/api/framework-items"),
      ),
      page.getByRole("button", { name: "Save" }).click(),
    ]);
    await page.reload();

    const persistedCard = page
      .locator('[data-testid^="framework-card-"]')
      .filter({ hasText: renamedPlaybook });
    await expect(persistedCard).toBeVisible();
    try {
      await persistedCard.click();
      await page.getByRole("tab", { name: "Edit" }).click();
      await expect(page.getByTestId("framework-editor-playbook")).toHaveValue(savedContent);
      await expect(page.getByText(revisedDescription)).toBeVisible();
      await page.getByRole("button", { name: "Playbooks" }).click();
      await expect(page.getByTestId("framework-grid-playbook")).toBeVisible();
    } finally {
      await page.getByRole("button", { name: "Playbooks" }).click({ timeout: 2_000 }).catch(() => {});
      if ((await persistedCard.count()) > 0) {
        await persistedCard.first().click();
        await page.getByRole("button", { name: "Delete playbook" }).click();
        await expect(page.getByRole("dialog")).toContainText(
          "This will permanently remove this playbook. This cannot be undone.",
        );
        await page.getByRole("button", { name: "Delete" }).click();
      }
      await page.reload();
    }

    await expect(persistedCard).toHaveCount(0);
  });

  test("sidebar active state is correct for Skills and Playbooks", async ({ page }) => {
    test.skip(
      !hasSupabaseRuntime,
      "Supabase runtime credentials required for sidebar active state test",
    );

    await authenticateWithBypass(page);

    await page.goto("/framework/skills");
    const skillsLink = page.getByRole("link", { name: "Skills" });
    const playbooksLink = page.getByRole("link", { name: "Playbooks" });
    await expect(skillsLink).toHaveAttribute("data-active", "true");
    await expect(playbooksLink).not.toHaveAttribute("data-active", "true");

    await playbooksLink.click();
    await expect(page.getByTestId("framework-screen-playbook")).toBeVisible();
    await expect(playbooksLink).toHaveAttribute("data-active", "true");
    await expect(skillsLink).not.toHaveAttribute("data-active", "true");
  });
});

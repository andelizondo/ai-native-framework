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

test.describe("framework skills", () => {
  test("loads seed data, creates a skill, edits it, and deletes it", async ({ page }) => {
    test.skip(
      !hasSupabaseRuntime,
      "Supabase runtime credentials required for the framework skills happy path",
    );

    await authenticateWithBypass(page);
    await page.goto("/framework/skills");

    await expect(page.getByTestId("framework-screen-skill")).toBeVisible();
    await expect(page.getByTestId("framework-grid-skill")).toContainText("PM");

    const skillName = `E2E Skill ${Date.now()}`;
    const skillDescription = "Created by Playwright";
    const renamedSkill = `${skillName} Revised`;
    const revisedDescription = "Sharper and more polished from Playwright";
    const savedContent = `# ${renamedSkill}\n\nSaved from Playwright.`;

    await page.getByRole("button", { name: "New skill" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Title").fill(skillName);
    await page.getByLabel("Description").fill(skillDescription);
    await page.getByRole("button", { name: "Create" }).click();

    await expect(page.getByTestId("framework-markdown-preview-skill")).toBeVisible();
    await page.getByLabel("Open skill actions").click();
    await page.getByRole("button", { name: "Rename" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Title").fill(renamedSkill);
    await page.getByLabel("Description").fill(revisedDescription);
    await page.getByRole("button", { name: "Apply" }).click();

    await page.getByLabel("Change icon").click();
    await page.getByLabel("Search or type emoji").fill("🧠");
    await page.getByRole("button", { name: "Use typed emoji" }).click();
    await page.getByRole("tab", { name: "Edit" }).click();

    const editor = page.getByTestId("framework-editor-skill");
    await editor.fill(savedContent);
    await page.getByRole("button", { name: "Save" }).click();
    await page.reload();

    const persistedCard = page
      .locator('[data-testid^="framework-card-"]')
      .filter({ hasText: renamedSkill });
    await expect(persistedCard).toBeVisible();
    await persistedCard.click();
    await page.getByRole("tab", { name: "Edit" }).click();
    await expect(page.getByTestId("framework-editor-skill")).toHaveValue(savedContent);
    await expect(page.getByText(revisedDescription)).toBeVisible();
    await page.getByRole("button", { name: "Skills" }).click();
    await expect(page.getByTestId("framework-grid-skill")).toBeVisible();

    await persistedCard.click();
    await page.getByLabel("Open skill actions").click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "This will permanently remove this skill. This cannot be undone.",
    );
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(persistedCard).toHaveCount(0);
  });
});

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
    await expect(page.getByTestId("framework-add-form-skill")).toBeVisible();
    await page.getByPlaceholder("Skill name").fill(skillName);
    await page.getByPlaceholder("Short description").fill(skillDescription);
    await page.getByRole("button", { name: "Create" }).click();

    const skillCard = page
      .locator('[data-testid^="framework-card-"]')
      .filter({ hasText: skillName });
    await expect(skillCard).toBeVisible();
    await skillCard.click();

    const editor = page.getByTestId("framework-editor-skill");
    await expect(editor).toBeVisible();
    await page.getByLabel("Emoji").fill("🧠");
    await page.getByLabel("Name").fill(renamedSkill);
    await page.getByLabel("Description").fill(revisedDescription);
    await editor.fill(savedContent);
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByTestId("framework-grid-skill")).toBeVisible();
    await page.reload();

    const persistedCard = page
      .locator('[data-testid^="framework-card-"]')
      .filter({ hasText: renamedSkill });
    await expect(persistedCard).toBeVisible();
    await persistedCard.click();
    await expect(page.getByTestId("framework-editor-skill")).toHaveValue(savedContent);
    await expect(page.getByLabel("Emoji")).toHaveValue("🧠");
    await expect(page.getByLabel("Description")).toHaveValue(revisedDescription);
    await page.getByRole("button", { name: "Skills" }).click();
    await expect(page.getByTestId("framework-grid-skill")).toBeVisible();

    await persistedCard.hover();
    await persistedCard.getByRole("button", { name: `Delete ${renamedSkill}` }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "This will permanently remove this skill. This cannot be undone.",
    );
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(persistedCard).toHaveCount(0);
  });
});

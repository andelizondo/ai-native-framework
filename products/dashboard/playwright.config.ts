import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for the dashboard product.
 *
 * BASE_URL is injected by CI (from the Vercel preview deployment URL) or
 * falls back to localhost:3000 for local runs.
 *
 * Projects:
 * - chromium: runs on every PR (critical-path + smoke suite)
 * - firefox:  runs in nightly CI only (expanded cross-browser confidence)
 *
 * See docs/QUALITY_STANDARD.md §5 and §7 for the full gate model.
 */

const baseURL = process.env.BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "on-failure" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      // Primary: runs on every PR against the Vercel preview URL
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Cross-browser: runs in nightly CI only (tag with --project=firefox)
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
  ],
  // Only start a local dev server when not pointing at an external URL.
  // In CI the BASE_URL is a Vercel preview, so webServer is skipped.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});

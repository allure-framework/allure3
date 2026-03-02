import { defineConfig, devices } from "@playwright/test";

/**
 * Config for frontend-backend UI tests only.
 * Runs globalSetup (Testcontainers Postgres + backend + frontend) then tests.
 * Usage: yarn test:frontend-backend  or  playwright test -c playwright.frontend-backend.config.ts
 */
export default defineConfig({
  testDir: "./test",
  testMatch: /frontend-backend\/.*\.spec\.ts$/,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  globalSetup: "./test/frontend-backend/globalSetup.ts",
  globalTeardown: "./test/frontend-backend/globalTeardown.ts",
  projects: [
    {
      name: "frontend-backend",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-sandbox",
            "--disable-setuid-sandbox",
          ],
        },
      },
    },
  ],
  reporter: [
    ["line"],
    [
      "allure-playwright",
      {
        resultsDir: "./out/allure-results",
        globalLabels: [{ name: "module", value: "e2e-frontend-backend" }],
      },
    ],
  ],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
});

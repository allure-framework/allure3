import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  projects: [
    {
      name: "chromium",
      testMatch: /^(?!.*frontend-backend).*$/,
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-software-rasterizer",
            "--disable-background-networking",
            "--disable-background-timer-throttling",
            "--disable-renderer-backgrounding",
            "--disable-backgrounding-occluded-windows",
          ],
        },
      },
    },
    {
      name: "firefox",
      testMatch: /^(?!.*frontend-backend).*$/,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "safari",
      testMatch: /^(?!.*frontend-backend).*$/,
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "frontend-backend",
      testMatch: /frontend-backend\/.*\.spec\.ts$/,
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
        globalLabels: [
          { name: "module", value: "e2e" },
        ],
        links: {
          issue: {
            urlTemplate: "https://github.com/allure-framework/allure3/issues/%s",
            nameTemplate: "Issue #%s",
          },
        },
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

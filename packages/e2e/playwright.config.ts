import { defaultPlaywrightConfig } from "@allurereport/common-config/playwright";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  ...defaultPlaywrightConfig({ issueLinks: true }),
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
    // Playwright's Firefox hangs on launch on macOS 27 machines with Firefox installed, see
    // https://github.com/microsoft/playwright/issues/42768
    ...(process.platform === "darwin" && !process.env.CI
      ? []
      : [
          {
            name: "firefox",
            use: { ...devices["Desktop Firefox"] },
          },
        ]),
    {
      name: "safari",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
});

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "safari",
      use: { ...devices["Desktop Safari"] },
    }
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
      },
    ],
  ],
  use: {
    trace: "on",
    screenshot: "only-on-failure",
  },
});

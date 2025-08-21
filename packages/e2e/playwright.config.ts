import { defineConfig, devices } from "@playwright/test";
import { platform } from "node:os";

const getOsLabel = () => {
  switch (platform()) {
    case "win32":
      return "Windows";
    case "darwin":
      return "macOS";
    case "linux":
      return "Linux";
    default:
      return platform();
  }
};

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
          { name: "os", value: getOsLabel() },
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
  },
});

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./",
  testMatch: "**/*.e2e.ts",
  reporter: [
    ["line"],
    [
      "allure-playwright",
      { resultsDir: "./out/allure-results", globalLabels: [{ name: "module", value: "static-server" }] },
    ],
  ],
});

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/e2e",
  reporter: [
    ["line"],
    [
      "allure-playwright",
      { resultsDir: "./out/allure-results", globalLabels: [{ name: "module", value: "static-server" }] },
    ],
  ],
});

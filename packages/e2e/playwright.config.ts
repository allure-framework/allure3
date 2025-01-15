import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  reporter: [
    ["line"],
    [
      "allure-playwright",
      {
        resultsDir: "./out/allure-results",
        globalLabels: [{ name: "module", value: "e2e" }]
      },
    ],
  ],
});

import { resolve } from "node:path";

import { defaultPlaywrightConfig } from "@allurereport/common-config/playwright";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  ...defaultPlaywrightConfig({
    resultsDir: process.env.ALLURE_RESULTS_DIR ?? "./out/size-results",
  }),
  testDir: "./measurements",
  outputDir: resolve("out", "size-tests"),
  forbidOnly: Boolean(process.env.CI),
  timeout: 120_000,
});

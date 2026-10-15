import { defaultPlaywrightConfig } from "@allurereport/common-config/playwright";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  ...defaultPlaywrightConfig({}),
  testDir: "./test/e2e",
});

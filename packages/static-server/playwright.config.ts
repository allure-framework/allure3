import { defaultPlaywrightConfig } from "@allurereport/test-config";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  ...defaultPlaywrightConfig({}),
  testDir: "./test/e2e",
});

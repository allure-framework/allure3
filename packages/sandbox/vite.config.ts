import * as os from "node:os";

import { Status } from "allure-js-commons";
import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    setupFiles: ["./vitest.setup.ts"],
    reporters: [
      "default",
      [
        "allure-vitest/reporter",
        {
          resultsDir: "./allure-results",
          links: {
            issue: {
              nameTemplate: "Issue #%s",
              urlTemplate: "https://issues.example.com/%s",
            },
            tms: {
              nameTemplate: "TMS #%s",
              urlTemplate: "https://tms.example.com/%s",
            },
            jira: {
              urlTemplate: "https://jira.example.com/browse/%s",
            },
          },
          environmentInfo: {
            os_platform: os.platform(),
            os_release: os.release(),
            os_version: os.version(),
            node_version: process.version,
          },
        },
      ],
    ],
  },
});

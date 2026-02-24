import { Status } from "allure-js-commons";
import * as os from "node:os";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
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

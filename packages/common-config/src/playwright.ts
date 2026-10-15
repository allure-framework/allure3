import { basename } from "node:path";
import { cwd } from "node:process";

import type { PlaywrightTestConfig } from "@playwright/test";

const packageName = basename(cwd());

export const defaultPlaywrightConfig = (options: {
  resultsDir?: string;
  reporter?: "line" | "list" | "github";
  issueLinks?: boolean;
}): PlaywrightTestConfig => ({
  reporter: [
    [options.reporter ?? "line"],
    [
      "allure-playwright",
      {
        resultsDir: options.resultsDir ?? "./out/allure-results",
        globalLabels: [
          { name: "module", value: packageName },
          { name: "type", value: "playwright" },
        ],
        ...(options.issueLinks
          ? {
              links: {
                issue: {
                  urlTemplate: "https://github.com/allure-framework/allure3/issues/%s",
                  nameTemplate: "Issue #%s",
                },
              },
            }
          : {}),
      },
    ],
  ],
});

import { randomUUID } from "node:crypto";
import { env } from "node:process";

import { Label } from "allure-js-commons";
import { type TestUserConfig, defineConfig } from "vitest/config";
const { ENABLE_COVERAGE, GITHUB_ACTIONS } = env;

export const defaultVitestConfig = (opts: { include?: string[]; globalLabels?: Label[]; coverageFiles?: string[] }) => {
  const ci = GITHUB_ACTIONS === "true";
  const labels = opts.globalLabels ?? [];
  const reporters: TestUserConfig["reporters"] = [
    ci ? "minimal" : "default",
    ["blob", { outputFile: `.vitest/blob/report-${randomUUID()}.json` }],
    [
      "allure-vitest/reporter",
      {
        resultsDir: env.ALLURE_RESULTS_DIR ?? "./out/allure-results",
        globalLabels: [{ name: "type", value: "vitest" }, ...labels],
        links: {
          issue: {
            urlTemplate: "https://github.com/allure-framework/allure3/issues/%s",
            nameTemplate: "Issue %s",
          },
        },
      },
    ],
  ];
  if (ci) reporters.push(["github-actions", { jobSummary: { enabled: false } }]);

  return defineConfig({
    test: {
      reporters,
      include: opts.include ?? ["./test/**/*.test.ts"],
      setupFiles: ["allure-vitest/setup"],
      coverage: {
        enabled: ENABLE_COVERAGE === "true",
        provider: "istanbul",
        include: opts.coverageFiles ?? ["src/**/*.{ts,tsx}"],
        reporter: ["text-summary"],
      },
    },
  });
};

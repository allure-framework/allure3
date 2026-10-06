import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { cwd, env } from "node:process";

import { Label } from "allure-js-commons";
import { type TestUserConfig, defineConfig } from "vitest/config";
const { ENABLE_COVERAGE, GITHUB_ACTIONS } = env;
const epicByPackagePrefix = new Map([
  ["core", "core"],
  ["cli", "cli"],
  ["plugin", "plugins"],
  ["web", "web"],
  ["reader", "reader"],
]);

export const defaultVitestConfig = (
  opts: { include?: string[]; globalLabels?: Label[]; coverageFiles?: string[] } = {},
) => {
  const ci = GITHUB_ACTIONS === "true";
  const packageName = basename(cwd());
  const epic = epicByPackagePrefix.get(packageName.split("-")[0]) ?? packageName;
  const customLabels = opts.globalLabels ?? [];
  const labels: Label[] = [
    ...[
      { name: "module", value: packageName },
      { name: "epic", value: epic },
      { name: "feature", value: packageName },
    ].filter(({ name }) => !customLabels.some((label) => label.name === name)),
    ...customLabels,
  ];
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

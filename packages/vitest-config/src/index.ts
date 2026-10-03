import { env } from "node:process";

import { Label } from "allure-js-commons";
import { defineConfig } from "vitest/config";
const { ENABLE_COVERAGE } = env;

export const defaultVitestConfig = (opts: { include?: string[]; globalLabels?: Label[]; coverageFiles?: string[] }) => {
  const labels = opts.globalLabels ?? [];
  return defineConfig({
    test: {
      include: opts.include ?? ["./test/**/*.test.ts"],
      setupFiles: ["allure-vitest/setup"],
      reporters: [
        "default",
        "blob",
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
      ],
      outputFile: { blob: ".vitest/blob/report.json" },
      coverage: {
        enabled: ENABLE_COVERAGE === "true",
        provider: "istanbul",
        include: opts.coverageFiles ?? ["src/**/*.{ts,tsx}"],
        reporter: ["text-summary"],
      },
    },
  });
};

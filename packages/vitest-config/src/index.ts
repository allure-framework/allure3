import { env } from "node:process";

import type { AllureVitestReporterConfig } from "allure-vitest/reporter";
import { defineConfig } from "vitest/config";

export const defaultVitestConfig = (opts: {
  include?: string[];
  globalLabels?: AllureVitestReporterConfig["globalLabels"];
  coverageFiles?: string[];
}) =>
  defineConfig({
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
            globalLabels: opts.globalLabels ?? [],
            links: {
              issue: {
                urlTemplate: "https://github.com/allure-framework/allure3/issues/%s",
                nameTemplate: "Issue %s",
              },
            },
          },
        ],
      ],
      outputFile: { blob: "coverage/blob/report.json" },
      coverage: {
        enabled: true,
        provider: "istanbul",
        include: opts.coverageFiles ?? ["src/**/*.{ts,tsx}"],
        // Render coverage only after the package blobs have been merged.
        reporter: [],
      },
    },
  });

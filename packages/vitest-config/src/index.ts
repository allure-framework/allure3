import { env } from "node:process";

import { Label } from "allure-js-commons";
import { defineConfig } from "vitest/config";

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
};

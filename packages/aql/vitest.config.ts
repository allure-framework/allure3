import { createRequire } from "node:module";
import * as path from "node:path";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);

export default defineConfig({
  test: {
    include: ["./tests/**/*.test.ts"],
    setupFiles: [require.resolve("allure-vitest/setup")],
    /**
     * Enable --expose-gc flag for memory profiling tests
     * This allows using global.gc() in tests for more accurate memory measurements
     */
    poolOptions: {
      threads: {
        execArgv: ["--expose-gc"],
      },
    },
    reporters: [
      "default",
      [
        "allure-vitest/reporter",
        {
          resultsDir: "./out/allure-results",
          globalLabels: [
            { name: "module", value: "aql" },
            { name: "layer", value: "unit" },
            { name: "feature", value: "AQL" },
          ],
          links: {
            issue: {
              urlTemplate: "https://github.com/allure-framework/allure3/issues/%s",
              nameTemplate: "Issue %s",
            },
          },
        },
      ],
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

import * as path from "node:path";

import { defaultVitestConfig } from "@allurereport/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  defaultVitestConfig({
    include: ["./tests/**/*.test.ts"],
    globalLabels: [
      { name: "module", value: "aql" },
      { name: "layer", value: "unit" },
      { name: "coverage", value: "aql" },
      { name: "epic", value: "coverage" },
      { name: "feature", value: "aql" },
    ],
  }),
  defineConfig({
    test: {
      // Enable global.gc() for more accurate memory profiling measurements.
      execArgv: ["--expose-gc"],
    },
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  }),
);

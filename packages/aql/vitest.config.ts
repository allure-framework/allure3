import * as path from "node:path";

import { defaultVitestConfig } from "@allurereport/test-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  defaultVitestConfig({
    include: ["./tests/**/*.test.ts"],
  }),
  defineConfig({
    test: {
      // Enable global.gc() for more accurate memory profiling measurements.
      execArgv: ["--expose-gc"],
    },
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  }),
);

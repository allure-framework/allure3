import * as path from "node:path";

import { defaultTasksConfig, defaultVitestConfig } from "@allurereport/common-config";
import { defineConfig, mergeConfig } from "vite-plus";

const packageRoot = import.meta.dirname;

export default defineConfig(
  mergeConfig(
    defaultVitestConfig(packageRoot, {
      include: ["./tests/**/*.test.ts"],
    }),
    {
      ...defaultTasksConfig(packageRoot),
      test: {
        // Enable global.gc() for more accurate memory profiling measurements.
        execArgv: ["--expose-gc"],
      },
      resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    },
  ),
);

import * as path from "node:path";

import { defaultVitestConfig } from "@allurereport/test-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  defaultVitestConfig({
    include: ["./src/**/*.test.tsx", "./src/**/*.test.ts"],
  }),
  defineConfig({
    test: {
      environment: "jsdom",
      maxWorkers: 1,
      minWorkers: 1,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "react": "preact/compat",
        "react-dom": "preact/compat",
      },
    },
  }),
);

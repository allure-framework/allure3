import * as path from "node:path";

import { defaultVitestConfig } from "@allurereport/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  defaultVitestConfig({
    include: ["./src/**/*.test.tsx", "./src/**/*.test.ts"],
    globalLabels: [
      { name: "module", value: "web-components" },
      { name: "coverage", value: "ui-components" },
      { name: "epic", value: "coverage" },
      { name: "feature", value: "ui-components" },
    ],
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

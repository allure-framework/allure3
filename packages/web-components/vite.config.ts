import * as path from "node:path";

import { defaultTasksConfig, defaultVitestConfig } from "@allurereport/common-config";
import { defineConfig, mergeConfig } from "vite-plus";

const packageRoot = import.meta.dirname;

export default defineConfig(
  mergeConfig(
    defaultVitestConfig(packageRoot, {
      include: ["./src/**/*.test.tsx", "./src/**/*.test.ts"],
    }),
    {
      ...defaultTasksConfig(packageRoot),
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
    },
  ),
);

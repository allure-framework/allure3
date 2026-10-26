import * as path from "node:path";

import { defaultTasksConfig, defaultVitestConfig } from "@allurereport/common-config";
import { defineConfig, mergeConfig } from "vite-plus";

const packageRoot = import.meta.dirname;

export default defineConfig(
  mergeConfig(
    defaultVitestConfig(packageRoot, {
      include: ["./test/**/*.test.{ts,tsx}"],
      coverageFiles: ["src/**/*.{ts,tsx,js}"],
    }),
    {
      ...defaultTasksConfig(packageRoot),
      resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
      test: {
        setupFiles: ["./vitest.setup.ts"],
      },
      oxc: {
        jsx: { runtime: "automatic", importSource: "preact" },
        // Also transform the legacy JavaScript views and their decorators instead of excluding them from coverage.
        include: /\.[cm]?[jt]sx?$/,
        exclude: /node_modules/,
        decorator: { legacy: true },
      },
    },
  ),
);

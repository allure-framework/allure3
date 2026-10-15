import { resolve } from "node:path";

import { defaultTasksConfig, defaultVitestConfig } from "@allurereport/common-config";
import { defineConfig, mergeConfig } from "vite-plus";

const packageRoot = import.meta.dirname;

export default defineConfig(
  mergeConfig(defaultVitestConfig(packageRoot, { include: ["./test/**/*.test.{ts,tsx}"] }), {
    ...defaultTasksConfig(packageRoot),
    resolve: { alias: { "@": resolve(packageRoot, "./src") } },
    // Vitest does not use Webpack's Babel transform; lower JSX before Istanbul instruments untested files.
    oxc: {
      jsx: { runtime: "automatic", importSource: "preact" },
    },
    test: {
      passWithNoTests: true,
    },
  }),
);

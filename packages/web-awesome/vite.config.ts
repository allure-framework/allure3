import { resolve } from "node:path";

import { defaultTasksConfig, defaultVitestConfig } from "@allurereport/common-config";
import { preact } from "@preact/preset-vite";
import { defineConfig, mergeConfig } from "vite-plus";

const packageRoot = import.meta.dirname;

export default defineConfig(
  mergeConfig(
    defaultVitestConfig(packageRoot, {
      include: ["./test/**/*.test.{ts,tsx}"],
    }),
    {
      ...defaultTasksConfig(packageRoot),
      plugins: [preact()],
      resolve: { alias: { "@": resolve(__dirname, "./src") } },
      test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./vitest.setup.ts"],
      },
    },
  ),
);

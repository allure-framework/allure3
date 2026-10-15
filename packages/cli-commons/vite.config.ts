import { resolve } from "node:path";

import { defaultTasksConfig, defaultVitestConfig } from "@allurereport/common-config";
import { defineConfig, mergeConfig } from "vite-plus";

const packageRoot = import.meta.dirname;

export default defineConfig(
  mergeConfig(defaultVitestConfig(packageRoot), {
    ...defaultTasksConfig(packageRoot),
    resolve: { alias: { "@": resolve(__dirname, "./src") } },
    test: {
      environment: "node",
    },
  }),
);

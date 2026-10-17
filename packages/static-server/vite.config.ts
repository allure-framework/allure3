import { defaultTasksConfig, defaultVitestConfig } from "@allurereport/common-config";
import { defineConfig, mergeConfig } from "vite-plus";

const packageRoot = import.meta.dirname;

export default defineConfig(
  mergeConfig(
    defaultVitestConfig(packageRoot, {
      include: ["./test/unit/**/*.test.ts"],
    }),
    defaultTasksConfig(packageRoot),
  ),
);

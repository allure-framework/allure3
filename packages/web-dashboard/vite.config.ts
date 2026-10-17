import { defaultTasksConfig, defaultVitestConfig } from "@allurereport/common-config";
import { defineConfig, mergeConfig } from "vite-plus";

const packageRoot = import.meta.dirname;

export default defineConfig(
  mergeConfig(defaultVitestConfig(packageRoot), {
    ...defaultTasksConfig(packageRoot),
    // Vitest does not use Webpack's Babel transform; lower JSX before Istanbul instruments untested files.
    oxc: {
      jsx: { runtime: "automatic", importSource: "preact" },
    },
    test: {
      passWithNoTests: true,
    },
  }),
);

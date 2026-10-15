import { defaultTasksConfig, defaultVitestConfig } from "@allurereport/common-config";
import { defineConfig, mergeConfig } from "vite-plus";

const packageRoot = import.meta.dirname;

export default defineConfig(
  mergeConfig(
    defaultVitestConfig(packageRoot, {
      coverageFiles: ["src/**/*.{ts,tsx,js}"],
    }),
    {
      ...defaultTasksConfig(packageRoot),
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

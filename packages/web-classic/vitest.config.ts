import { defaultVitestConfig } from "@allurereport/test-config";
import { defineConfig, mergeConfig } from "vite-plus";

export default mergeConfig(
  defaultVitestConfig({
    coverageFiles: ["src/**/*.{ts,tsx,js}"],
  }),
  defineConfig({
    oxc: {
      jsx: { runtime: "automatic", importSource: "preact" },
      // Also transform the legacy JavaScript views and their decorators instead of excluding them from coverage.
      include: /\.[cm]?[jt]sx?$/,
      exclude: /node_modules/,
      decorator: { legacy: true },
    },
  }),
);

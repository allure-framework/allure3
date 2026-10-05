import { defaultVitestConfig } from "@allurereport/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  defaultVitestConfig({ globalLabels: [{ name: "module", value: "web-dashboard" }] }),
  defineConfig({
    // Vitest does not use Webpack's Babel transform; lower JSX before Istanbul instruments untested files.
    oxc: {
      jsx: { runtime: "automatic", importSource: "preact" },
    },
    test: {
      passWithNoTests: true,
    },
  }),
);

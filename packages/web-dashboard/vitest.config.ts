import { defaultVitestConfig } from "@allurereport/test-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  defaultVitestConfig(),
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

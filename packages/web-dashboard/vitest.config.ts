import { resolve } from "node:path";

import { defaultVitestConfig } from "@allurereport/test-config";
import { defineConfig, mergeConfig } from "vite-plus";

export default mergeConfig(
  defaultVitestConfig({ include: ["./test/**/*.test.{ts,tsx}"] }),
  defineConfig({
    resolve: { alias: { "@": resolve(__dirname, "./src") } },
    // Vitest does not use Webpack's Babel transform; lower JSX before Istanbul instruments untested files.
    oxc: {
      jsx: { runtime: "automatic", importSource: "preact" },
    },
    test: {
      passWithNoTests: true,
    },
  }),
);

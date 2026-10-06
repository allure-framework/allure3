import { resolve } from "node:path";

import { defaultVitestConfig } from "@allurereport/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  defaultVitestConfig(),
  defineConfig({
    resolve: { alias: { "@": resolve(__dirname, "./src") } },
    test: {
      environment: "node",
    },
  }),
);

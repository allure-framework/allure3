import { resolve } from "node:path";

import { defaultVitestConfig } from "@allurereport/test-config";
import { defineConfig, mergeConfig } from "vite-plus";

export default mergeConfig(
  defaultVitestConfig(),
  defineConfig({
    resolve: { alias: { "@": resolve(__dirname, "./src") } },
    test: {
      environment: "jsdom",
    },
  }),
);

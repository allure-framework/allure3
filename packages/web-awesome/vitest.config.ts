import { resolve } from "node:path";

import { defaultVitestConfig } from "@allurereport/test-config";
import { preact } from "@preact/preset-vite";
import { defineConfig, mergeConfig } from "vite-plus";

export default mergeConfig(
  defaultVitestConfig({
    include: ["./test/**/*.test.{ts,tsx}"],
  }),
  defineConfig({
    plugins: [preact()],
    resolve: { alias: { "@": resolve(__dirname, "./src") } },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./vitest.setup.ts"],
    },
  }),
);

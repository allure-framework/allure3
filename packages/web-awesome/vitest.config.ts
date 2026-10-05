import { resolve } from "node:path";

import { defaultVitestConfig } from "@allurereport/vitest-config";
import { preact } from "@preact/preset-vite";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  defaultVitestConfig({
    include: ["./test/**/*.test.{ts,tsx}"],
    globalLabels: [{ name: "module", value: "web-awesome" }],
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

import { createRequire } from "node:module";
import * as path from "node:path";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);
const baseDir = path.dirname(new URL(import.meta.url).pathname);

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["./src/**/*.test.tsx", "./src/**/*.test.ts"],
    setupFiles: [require.resolve("allure-vitest/setup")],
    reporters: [
      "default",
      [
        "allure-vitest/reporter",
        {
          resultsDir: "./out/allure-results",
          globalLabels: [{ name: "module", value: "web-components" }],
        },
      ],
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(baseDir, "./src"),
    },
  },
});

import { createRequire } from "node:module";
import * as path from "node:path";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["./src/**/*.test.tsx"],
    setupFiles: [require.resolve("allure-vitest/setup"), "./setup-tests.ts"],
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
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

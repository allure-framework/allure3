import { createRequire } from "node:module";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["./test/**/*.test.ts"],
    setupFiles: [require.resolve("allure-vitest/setup")],
    reporters: ["default", ["allure-vitest/reporter", { resultsDir: "./out/allure-results" }]],
  },
});

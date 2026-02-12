import { createRequire } from "node:module";
import { defineConfig } from "vitest/config";
import { resolve } from "path";
import { preact } from "@preact/preset-vite";

const require = createRequire(import.meta.url);

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["./test/**/*.test.{ts,tsx}"],
    globals: true,
    setupFiles: [
      require.resolve("allure-vitest/setup"),
      "./vitest.setup.ts",
    ],
    reporters: [
      "default",
      [
        "allure-vitest/reporter",
        { resultsDir: "./out/allure-results", globalLabels: [{ name: "module", value: "web-awesome" }] },
      ],
    ],
  },
});

import { createRequire } from "node:module";
import * as path from "node:path";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);

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
      "@": path.resolve(__dirname, "./src"),
      "react": path.resolve(__dirname, "../../node_modules/preact/compat"),
      "react-dom/test-utils": path.resolve(__dirname, "../../node_modules/preact/test-utils"),
      "react-dom": path.resolve(__dirname, "../../node_modules/preact/compat"),
      "react/jsx-runtime": path.resolve(__dirname, "../../node_modules/preact/jsx-runtime"),
    },
  },
});

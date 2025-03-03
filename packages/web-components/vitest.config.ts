import * as path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["./src/**/*.test.tsx", "./src/**/*.test.ts"],
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
      "react": "preact/compat",
      "react-dom": "preact/compat",
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler",
      },
    },
  },
});

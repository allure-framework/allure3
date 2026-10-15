import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      "vp:test:clean": {
        command: "rimraf out test-results",
        cache: false,
      },
      "vp:test": {
        command: "playwright test",
        cache: {
          input: [
            "**/*.{ts,json}",
            "test/fixtures/**/*",
            "!test-results/**",
            "!out/**",
            { pattern: "packages/*/src/**", base: "workspace" },
            { pattern: "packages/*/*.{ts,json}", base: "workspace" },
            { pattern: "package.json", base: "workspace" },
            { pattern: "yarn.lock", base: "workspace" },
            { pattern: "tsconfig.json", base: "workspace" },
          ],
          output: ["out/allure-results/**", "test-results/**"],
        },
      },
    },
  },
});

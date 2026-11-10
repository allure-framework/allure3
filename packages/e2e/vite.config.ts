import { env } from "node:process";

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
        cache:
          env.CI === "true" || env.GITHUB_ACTIONS === "true"
            ? false
            : {
                env: ["ENABLE_COVERAGE", "ALLURE_TESTPLAN_PATH", "ALLURE_RERUN", "ALLURE_RESULTS_DIR"],
                input: [
                  "**/*.{ts,json}",
                  "test/fixtures/**/*",
                  "!test-results/**",
                  "!out/**",
                  { pattern: "packages/*/src/**", base: "workspace" },
                  { pattern: "packages/*/static/**", base: "workspace" },
                  { pattern: "packages/*/*.{ts,json}", base: "workspace" },
                  { pattern: "packages/*/.babelrc.*", base: "workspace" },
                  { pattern: "packages/*/rollup.config.*", base: "workspace" },
                  { pattern: "packages/*/vite.config.*", base: "workspace" },
                  { pattern: "packages/*/webpack.config.*", base: "workspace" },
                  { pattern: "packages/*/postcss.config.*", base: "workspace" },
                  { pattern: "packages/web-components/svgr.config.js", base: "workspace" },
                  { pattern: "package.json", base: "workspace" },
                  { pattern: "yarn.lock", base: "workspace" },
                  { pattern: ".yarnrc.yml", base: "workspace" },
                  { pattern: "vite.config.*", base: "workspace" },
                  { pattern: "tsconfig*.json", base: "workspace" },
                  { pattern: "scripts/pack-report-static.mjs", base: "workspace" },
                  { pattern: "scripts/report-feature-assets.mjs", base: "workspace" },
                ],
                output: ["out/allure-results/**", "test-results/**"],
              },
      },
    },
  },
});

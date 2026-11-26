import { env } from "node:process";

import { defineConfig, type ViteUserConfig } from "vite-plus";

type TaskDefinition = NonNullable<NonNullable<ViteUserConfig["run"]>["tasks"]>[string];

const ci = env.CI === "true" || env.GITHUB_ACTIONS === "true";
const testTask = {
  command: "playwright test",
  dependsOn: ["vp:test:clean"],
  cache: ci
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
} satisfies TaskDefinition;

export default defineConfig({
  run: {
    tasks: {
      "vp:test:clean": {
        command: "rimraf out test-results",
        cache: false,
      },
      "vp:test:e2e": testTask,
      // exclude from "yarn test" on CI so it can be executed in a separate job
      "vp:test": !ci
        ? testTask
        : {
            command: "node -e \"console.log('This is a no-op task, nothing will be executed')\"",
            cache: false,
          },
    },
  },
});

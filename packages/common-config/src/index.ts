import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, join } from "node:path";
import { env } from "node:process";

import type { Label } from "allure-js-commons";
import type { TestUserConfig, ViteUserConfig } from "vite-plus";

const ci = env.CI === "true" || env.GITHUB_ACTIONS === "true";
const { ENABLE_COVERAGE, GITHUB_ACTIONS } = env;
const epicByPackagePrefix = new Map([
  ["core", "core"],
  ["cli", "cli"],
  ["plugin", "plugins"],
  ["web", "web"],
  ["reader", "reader"],
]);
const allureResultsDir = env.ALLURE_RESULTS_DIR ?? "out/allure-results";

const loadScript = (
  packageJson: { workspaces?: unknown; scripts?: Record<string, string> },
  name: string,
): string | undefined => {
  if (packageJson.workspaces) {
    throw new Error(`Cannot define package tasks for workspace root!`);
  }

  const command = packageJson.scripts?.[name];

  return typeof command === "string" && command.trim() ? command : undefined;
};

export const defaultTasksConfig = (
  packageRoot: string,
  options: {
    buildInput?: string[];
    buildOutput?: string[];
    testInput?: string[];
    testOutput?: string[];
  } = {},
): Pick<ViteUserConfig, "run"> => {
  // custom command parsing exists for compatibility with running builds and tests with plain yarn while allowing
  // to define the same command counterparts with a more granular caching configuration
  const packageJson = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  const tasks: NonNullable<NonNullable<ViteUserConfig["run"]>["tasks"]> = {};

  const buildScript = loadScript(packageJson, "build");
  if (buildScript) {
    let buildCommands = buildScript.split("&&");
    if (buildCommands.length > 1 && ["rimraf", "run clean"].some((str) => buildCommands[0].includes(str))) {
      buildCommands = buildCommands.slice(1);
    }

    tasks["vp:clean"] = {
      command: "run clean",
      cache: false,
    };
    tasks["vp:build"] = {
      command: buildCommands,
      dependsOn: ["vp:clean", { task: "vp:build", from: ["dependencies", "devDependencies"] }],
      cache:
        env.VITE_NO_CACHE === "true"
          ? false
          : {
              env: ["NODE_ENV"],
              input: [
                { auto: true },
                { pattern: "!.yarn/install-state.gz", base: "workspace" },
                "!out/**",
                "!dist/**",
                "!test/**",
                ...(options.buildInput ?? []),
              ],
              output: ["dist/**", ...(options.buildOutput ?? [])],
            },
    };
  }

  const testScript = loadScript(packageJson, "test");
  if (testScript) {
    let testCommands = testScript.split("&&");
    const cleanup = [`rimraf ${allureResultsDir} .vitest`];
    if (testCommands.length > 1 && ["rimraf", "clean"].some((str) => testCommands[0].includes(str))) {
      testCommands = testCommands.slice(1);
    }
    tasks["vp:clean:test"] = {
      command: cleanup,
      cache: false,
    };
    tasks["vp:test"] = {
      command: testCommands,
      dependsOn: ["vp:clean:test"],
      cache:
        ci || env.VITE_NO_CACHE === "true"
          ? false
          : {
              env: ["ENABLE_COVERAGE", "ALLURE_TESTPLAN_PATH", "ALLURE_RERUN", "ALLURE_RESULTS_DIR"],
              input: [
                { auto: true },
                { pattern: "!.yarn/install-state.gz", base: "workspace" },
                { pattern: "!allure-report/**", base: "workspace" },
                `!${allureResultsDir}/**`,
                "!.vitest/**",
                "!test-results/**",
                "!allure-report/**",
                ...(options.testInput ?? []),
              ],
              output: [`${allureResultsDir}/**`, ".vitest/blob/**", "test-results/**", ...(options.testOutput ?? [])],
            },
    };
  } else {
    // vite+ uses fail-fast by default so tests still need to run through yarn workspaces
    // which prevents from automatically skipping packages where task is not defined
    // in order to not define --exclude list of workspaces, create simple no-op task
    // TODO: remove once https://github.com/voidzero-dev/vite-task/issues/822 is implemented
    tasks["vp:test"] = {
      command: "echo 'This is a no-op task because package has no tests'",
      cache: false,
    };
  }

  return {
    run: { tasks },
  } satisfies ViteUserConfig;
};

export const defaultVitestConfig = (
  packageRoot: string,
  opts: { include?: string[]; globalLabels?: Label[]; coverageFiles?: string[] } = {},
): ViteUserConfig => {
  const packageName = basename(packageRoot);
  const ci = GITHUB_ACTIONS === "true";
  const epic = epicByPackagePrefix.get(packageName.split("-")[0]) ?? packageName;
  const customLabels = opts.globalLabels ?? [];
  const labels: Label[] = [
    ...[
      { name: "module", value: packageName },
      { name: "epic", value: epic },
      { name: "feature", value: packageName },
    ].filter(({ name }) => !customLabels.some((label) => label.name === name)),
    ...customLabels,
  ];
  const requireFromPackage = createRequire(join(packageRoot, "package.json"));
  const reporters: TestUserConfig["reporters"] = [
    ci ? "minimal" : "default",
    ["blob", { outputFile: `.vitest/blob/report-${randomUUID()}.json` }],
    [
      // ensure the correct package specific version of allure is loaded
      requireFromPackage.resolve("allure-vitest/reporter"),
      {
        resultsDir: allureResultsDir,
        globalLabels: [{ name: "type", value: "vitest" }, ...labels],
        links: {
          issue: {
            urlTemplate: "https://github.com/allure-framework/allure3/issues/%s",
            nameTemplate: "Issue %s",
          },
        },
      },
    ],
  ];
  if (ci) reporters.push(["github-actions", { jobSummary: { enabled: false } }]);

  return {
    test: {
      reporters,
      include: opts.include ?? ["./test/**/*.test.ts"],
      setupFiles: ["allure-vitest/setup"],
      coverage: {
        enabled: ENABLE_COVERAGE === "true",
        provider: "istanbul",
        include: opts.coverageFiles ?? ["src/**/*.{ts,tsx}"],
        reporter: ["text-summary"],
      },
    },
  } satisfies ViteUserConfig;
};

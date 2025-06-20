import { AllureReport, enforcePlugin, readConfig } from "@allurereport/core";
import LogPlugin, { type LogPluginOptions } from "@allurereport/plugin-log";
import * as console from "node:console";
import { realpath } from "node:fs/promises";
import process from "node:process";
import { createCommand } from "../utils/commands.js";

export type LogCommandOptions = {
  cwd?: string;
  config?: string;
  allSteps?: boolean;
  withTrace?: boolean;
  groupBy?: "suites" | "features" | "packages" | "none";
};

export const LogCommandAction = async (resultsDir: string, options: LogCommandOptions) => {
  const cwd = await realpath(options.cwd ?? process.cwd());
  const before = new Date().getTime();
  const { config: configPath, allSteps, withTrace, groupBy } = options;
  const defaultLogOptions = {
    allSteps,
    withTrace,
    groupBy,
  } as LogPluginOptions;
  const config = enforcePlugin(await readConfig(cwd, configPath), {
    id: "log",
    enabled: true,
    options: defaultLogOptions,
    plugin: new LogPlugin(defaultLogOptions),
  });
  const allureReport = new AllureReport(config);

  await allureReport.start();
  await allureReport.readDirectory(resultsDir);
  await allureReport.done();

  const after = new Date().getTime();

  console.log(`the report successfully generated (${after - before}ms)`);
};

export const LogCommand = createCommand({
  name: "log <resultsDir>",
  description: "Prints Allure Results to the console",
  options: [
    [
      "--config, -c <file>",
      {
        description: "The path Allure config file",
      },
    ],
    [
      "--cwd <cwd>",
      {
        description: "The working directory for the command to run (Default: current working directory)",
      },
    ],
    [
      "--group-by <label>",
      {
        description: "Group tests by type (none, suite, feature, package, etc.)",
        default: "suite",
      },
    ],
    [
      "--all-steps",
      {
        description: "Show all steps. By default only failed steps are shown",
        default: false,
      },
    ],
    [
      "--with-trace",
      {
        description: "Print stack trace for failed tests",
        default: false,
      },
    ],
  ],
  action: LogCommandAction,
});

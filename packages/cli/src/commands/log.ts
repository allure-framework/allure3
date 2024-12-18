import { AllureReport, resolveConfig } from "@allurereport/core";
import * as console from "node:console";
import { createCommand } from "../utils/commands.js";

export type LogCommandOptions = {
  allSteps?: boolean;
  withTrace?: boolean;
  groupBy?: "suites" | "features" | "packages" | "none";
};

export const LogCommandAction = async (resultsDir: string, options: LogCommandOptions) => {
  const before = new Date().getTime();

  const config = await resolveConfig({
    plugins: {
      "@allurereport/plugin-log": {
        options,
      },
    },
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

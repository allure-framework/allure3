import { AllureReport, enforcePlugin, readConfig } from "@allurereport/core";
import DashboardPlugin, { type DashboardPluginOptions } from "@allurereport/plugin-dashboard";
import * as console from "node:console";
import { realpath } from "node:fs/promises";
import process from "node:process";
import { createCommand } from "../utils/commands.js";

type DashboardCommandOptions = {
  cwd?: string;
  config?: string;
  output?: string;
  reportName?: string;
  reportLanguage?: string;
  logo?: string;
  singleFile?: boolean;
  theme?: "light" | "dark";
};

export const DashboardCommandAction = async (resultsDir: string, options: DashboardCommandOptions) => {
  const cwd = await realpath(options.cwd ?? process.cwd());
  const before = new Date().getTime();
  const { config: configPath, output, reportName: name, ...rest } = options;
  const defaultDashboardOptions = {
    ...rest,
    reportLanguage: rest.reportLanguage ?? "en",
  } as DashboardPluginOptions;
  const config = enforcePlugin(
    await readConfig(cwd, configPath, {
      output,
      name,
    }),
    {
      id: "dashboard",
      enabled: true,
      options: defaultDashboardOptions,
      plugin: new DashboardPlugin(defaultDashboardOptions),
    },
  );
  const allureReport = new AllureReport(config);

  await allureReport.start();
  await allureReport.readDirectory(resultsDir);
  await allureReport.done();

  const after = new Date().getTime();

  console.log(`the report successfully generated (${after - before}ms)`);
};

export const DashboardCommand = createCommand({
  name: "dashboard <resultsDir>",
  description: "Generates Allure Dashboard report based on provided Allure Results",
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
      "--output, -o <file>",
      {
        description: "The output directory name. Absolute paths are accepted as well",
        default: "allure-report",
      },
    ],
    [
      "--report-name, --name <string>",
      {
        description: "The report name",
        default: "Allure Report",
      },
    ],
    [
      "--single-file",
      {
        description: "Generate single file report",
        default: false,
      },
    ],
    [
      "--logo <string>",
      {
        description: "Path to the report logo which will be displayed in the header",
      },
    ],
    [
      "--theme <string>",
      {
        description: "Default theme of the report (default: OS theme)",
      },
    ],
    [
      "--report-language, --lang <string>",
      {
        description: "Default language of the report (default: OS language)",
      },
    ],
  ],
  action: DashboardCommandAction,
});

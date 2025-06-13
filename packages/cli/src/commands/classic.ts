import { AllureReport, enforcePlugin, readConfig } from "@allurereport/core";
import ClassicPlugin, { type ClassicPluginOptions } from "@allurereport/plugin-classic";
import * as console from "node:console";
import { realpath } from "node:fs/promises";
import process from "node:process";
import { createCommand } from "../utils/commands.js";

type ClassicCommandOptions = {
  cwd?: string;
  config?: string;
  output?: string;
  reportName?: string;
  reportLanguage?: string;
  singleFile?: boolean;
  historyPath?: string;
  knownIssues?: string;
};

export const ClassicCommandAction = async (resultsDir: string, options: ClassicCommandOptions) => {
  const cwd = await realpath(options.cwd ?? process.cwd());
  const before = new Date().getTime();
  const { config: configPath, output, reportName: name, historyPath, knownIssues: knownIssuesPath, ...rest } = options;
  const defaultClassicOptions = {
    ...rest,
  } as ClassicPluginOptions;
  const config = enforcePlugin(
    await readConfig(cwd, configPath, {
      output,
      name,
      historyPath,
      knownIssuesPath,
    }),
    {
      id: "classic",
      enabled: true,
      options: defaultClassicOptions,
      plugin: new ClassicPlugin(defaultClassicOptions),
    },
  );
  const allureReport = new AllureReport(config);

  await allureReport.start();
  await allureReport.readDirectory(resultsDir);
  await allureReport.done();

  const after = new Date().getTime();

  console.log(`the report successfully generated (${after - before}ms)`);
};

export const ClassicCommand = createCommand({
  name: "classic <resultsDir>",
  description: "Generates Allure Classic report based on provided Allure Results",
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
      "--report-language, --lang <string>",
      {
        description: "Default language of the report (default: OS language)",
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
      "--history-path, -h <file>",
      {
        description: "The path to history file",
      },
    ],
    [
      "--known-issues <file>",
      {
        description: "Path to the known issues file. Updates the file and quarantines failed tests when specified",
      },
    ],
  ],
  action: ClassicCommandAction,
});

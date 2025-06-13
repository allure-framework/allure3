import { AllureReport, enforcePlugin, readConfig } from "@allurereport/core";
import { default as AwesomePlugin, type AwesomePluginOptions } from "@allurereport/plugin-awesome";
import * as console from "node:console";
import { realpath } from "node:fs/promises";
import process from "node:process";
import { createCommand } from "../utils/commands.js";

type AwesomeCommandOptions = {
  cwd?: string;
  config?: string;
  output?: string;
  reportName?: string;
  reportLanguage?: string;
  logo?: string;
  singleFile?: boolean;
  historyPath?: string;
  knownIssues?: string;
  groupBy?: string;
};

export const AwesomeCommandAction = async (resultsDir: string, options: AwesomeCommandOptions) => {
  const cwd = await realpath(options.cwd ?? process.cwd());
  const before = new Date().getTime();
  const {
    config: configPath,
    output,
    reportName,
    historyPath,
    knownIssues: knownIssuesPath,
    groupBy,
    ...rest
  } = options;
  const defaultAwesomeOptions = {
    ...rest,
    groupBy: groupBy?.split(","),
  } as AwesomePluginOptions;
  const config = enforcePlugin(
    await readConfig(cwd, configPath, {
      output,
      name: reportName,
      knownIssuesPath,
      historyPath,
    }),
    {
      id: "awesome",
      enabled: true,
      options: defaultAwesomeOptions,
      plugin: new AwesomePlugin(defaultAwesomeOptions),
    },
  );
  const allureReport = new AllureReport(config);

  await allureReport.start();
  await allureReport.readDirectory(resultsDir);
  await allureReport.done();

  const after = new Date().getTime();

  console.log(`the report successfully generated (${after - before}ms)`);
};

export const AwesomeCommand = createCommand({
  name: "awesome <resultsDir>",
  description: "Generates Allure Awesome report based on provided Allure Results",
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
    [
      "--group-by, -g <string>",
      {
        description: "Group test results by labels. The labels should be separated by commas",
        default: "parentSuite,suite,subSuite",
      },
    ],
  ],
  action: AwesomeCommandAction,
});

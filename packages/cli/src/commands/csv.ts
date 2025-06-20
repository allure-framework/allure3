import { AllureReport, enforcePlugin, readConfig } from "@allurereport/core";
import CsvPlugin, { type CsvPluginOptions } from "@allurereport/plugin-csv";
import * as console from "node:console";
import { realpath } from "node:fs/promises";
import process from "node:process";
import { createCommand } from "../utils/commands.js";

type CsvCommandOptions = {
  cwd?: string;
  config?: string;
  separator?: string;
  disableHeaders?: boolean;
  output?: string;
  knownIssues?: string;
};

export const CsvCommandAction = async (resultsDir: string, options: CsvCommandOptions) => {
  const cwd = await realpath(options.cwd ?? process.cwd());
  const before = new Date().getTime();
  const { config: configPath, output, knownIssues: knownIssuesPath, separator, disableHeaders } = options;
  const defaultCsvOptions = {
    separator,
    disableHeaders,
  } as CsvPluginOptions;
  const config = enforcePlugin(
    await readConfig(cwd, configPath, {
      output,
      knownIssuesPath,
    }),
    {
      id: "csv",
      enabled: true,
      options: defaultCsvOptions,
      plugin: new CsvPlugin(defaultCsvOptions),
    },
  );
  const allureReport = new AllureReport(config);

  await allureReport.start();
  await allureReport.readDirectory(resultsDir);
  await allureReport.done();

  const after = new Date().getTime();

  console.log(`the report successfully generated (${after - before}ms)`);
};

export const CsvCommand = createCommand({
  name: "csv <resultsDir>",
  description: "Generates CSV report based on provided Allure Results",
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
        description: "The output file name. Absolute paths are accepted as well",
        default: "allure.csv",
      },
    ],
    [
      "--disable-headers",
      {
        description: "Specify, to disable CSV headers",
      },
    ],
    [
      "--separator <string>",
      {
        description: "The csv separator",
        default: ",",
      },
    ],
    [
      "--known-issues <file>",
      {
        description: "Path to the known issues file. Updates the file and quarantines failed tests when specified",
      },
    ],
  ],
  action: CsvCommandAction,
});

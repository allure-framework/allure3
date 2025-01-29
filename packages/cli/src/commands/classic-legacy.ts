import { AllureReport, resolveConfig } from "@allurereport/core";
import * as console from "node:console";
import { createCommand } from "../utils/commands.js";

type ClassicCommandOptions = {
  output?: string;
  reportName?: string;
  reportLanguage?: string;
  singleFile?: boolean;
  historyPath?: string;
  knownIssues?: string;
};

export const ClassicLegacyCommandAction = async (resultsDir: string, options: ClassicCommandOptions) => {
  const before = new Date().getTime();
  const { output, reportName: name, historyPath, knownIssues: knownIssuesPath, ...rest } = options;
  const config = await resolveConfig({
    output,
    name,
    historyPath,
    knownIssuesPath,
    plugins: {
      "@allurereport/plugin-classic-legacy": {
        options: rest,
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

export const ClassicLegacyCommand = createCommand({
  name: "classic-legacy <resultsDir>",
  description: "Generates Allure Classic report based on provided Allure Results",
  options: [
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
  action: ClassicLegacyCommandAction,
});

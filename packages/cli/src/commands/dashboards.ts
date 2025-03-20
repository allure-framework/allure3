import { AllureReport, resolveConfig } from "@allurereport/core";
import * as console from "node:console";
import { createCommand } from "../utils/commands.js";

type DashboardsCommandOptions = {
  output?: string;
  reportName?: string;
  reportLanguage?: string;
  logo?: string;
  singleFile?: boolean;
  historyPath?: string;
  knownIssues?: string;
  groupBy?: string;
};

export const DashboardsCommandAction = async (resultsDir: string, options: DashboardsCommandOptions) => {
  const before = new Date().getTime();
  const { output, reportName: name, historyPath, knownIssues: knownIssuesPath, groupBy, ...rest } = options;
  const config = await resolveConfig({
    output,
    name,
    historyPath,
    knownIssuesPath,
    plugins: {
      "@allurereport/plugin-dashboards": {
        options: {
          ...rest,
          groupBy: groupBy?.split(","),
        },
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

export const DashboardsCommand = createCommand({
  name: "dashboards <resultsDir>",
  description: "Generates Allure Dashboards report based on provided Allure Results",
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
  action: DashboardsCommandAction,
});

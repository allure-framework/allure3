import { AllureReport, resolveConfig } from "@allurereport/core";
import * as console from "node:console";
import { createCommand } from "../utils/commands.js";

type CsvCommandOptions = {
  separator?: string;
  disableHeaders?: boolean;
  output?: string;
  knownIssues?: string;
};

export const CsvCommandAction = async (resultsDir: string, options: CsvCommandOptions) => {
  const before = new Date().getTime();
  const config = await resolveConfig({
    plugins: {
      "@allurereport/plugin-csv": {
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

export const CsvCommand = createCommand({
  name: "csv <resultsDir>",
  description: "Generates CSV report based on provided Allure Results",
  options: [
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

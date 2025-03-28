import { AllureReport, resolveConfig } from "@allurereport/core";
import { createCommand } from "../utils/commands.js";

type CommandOptions = {
  historyPath?: string;
  reportName?: string;
};

export const HistoryCommandAction = async (resultsDir: string, options: CommandOptions) => {
  const config = await resolveConfig({
    historyPath: options.historyPath,
    name: options.reportName,
    // disable all plugins
    plugins: {},
  });
  const allureReport = new AllureReport(config);
  await allureReport.start();
  await allureReport.readDirectory(resultsDir);
  await allureReport.done();
};

export const HistoryCommand = createCommand({
  name: "history <resultsDir>",
  description: "Generates the history to specified folder",
  options: [
    [
      "--history-path, -h <file>",
      {
        description: "The path to history file",
        default: "history.jsonl",
      },
    ],
    [
      "--report-name, --name <string>",
      {
        description: "The report name",
        default: "Allure Report",
      },
    ],
  ],
  action: HistoryCommandAction,
});

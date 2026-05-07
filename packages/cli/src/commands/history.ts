import * as console from "node:console";
import process, { exit } from "node:process";

import { AllureReport, resolveConfig } from "@allurereport/core";
import { Command, Option } from "clipanion";
import { red } from "yoctocolors";

import { searchAllureResultDirectories } from "../utils/fileSystem.js";

export class HistoryCommand extends Command {
  static paths = [["history"]];

  static usage = Command.Usage({
    description: "Generates the history to specified folder",
    details: "This command generates history from the provided Allure Results directory.",
    examples: [
      ["history ./allure-results", "Generate history from the ./allure-results directory"],
      [
        "history ./allure-results --history-path custom-history.jsonl",
        "Generate history from the ./allure-results directory to the custom-history.jsonl file",
      ],
      [
        "history ./packages/*/allure-results",
        "Generate history from all Allure result directories matching the pattern",
      ],
      [
        "history ./packages/foo/allure-results ./packages/bar/allure-results",
        "Generate history from two Allure result directories",
      ],
    ],
  });

  resultsDir = Option.Rest({
    name: "Patterns to match test results directories in the current working directory (default: ./**/allure-results)",
  });

  historyPath = Option.String("--history-path,-h", {
    description: "The path to history file",
  });

  historyLimit = Option.String("--history-limit", {
    description: "Limits the number of history entries to keep (default: unlimited)",
  });

  reportName = Option.String("--report-name,--name", {
    description: "The report name",
  });

  async execute() {
    const { resultDirectories, patterns } = await searchAllureResultDirectories(process.cwd(), this.resultsDir);
    if (!resultDirectories.length) {
      console.error(red(`No test results directories found matching pattern: ${patterns}`));
      exit(1);
      return;
    }

    const config = await resolveConfig({
      historyPath: this.historyPath ?? "history.jsonl",
      historyLimit: this.historyLimit ? Number(this.historyLimit) : undefined,
      name: this.reportName ?? "Allure Report",
      // disable all plugins
      plugins: {},
    });

    const allureReport = new AllureReport(config);

    await allureReport.start();

    for (const directory of resultDirectories) {
      await allureReport.readDirectory(directory);
    }

    await allureReport.done();
  }
}

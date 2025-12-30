import { AllureReport, resolveConfig } from "@allurereport/core";
import { Command, Option } from "clipanion";
import * as console from "node:console";
import { existsSync } from "node:fs";
import { exit } from "node:process";
import { red } from "yoctocolors";

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
    ],
  });

  resultsDir = Option.String({ required: true, name: "The directory with Allure results" });

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
    if (!existsSync(this.resultsDir)) {
      console.error(red(`The given test results directory doesn't exist: ${this.resultsDir}`));
      exit(1);
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
    await allureReport.readDirectory(this.resultsDir);
    await allureReport.done();
  }
}

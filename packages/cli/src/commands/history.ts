import { AllureReport, resolveConfig } from "@allurereport/core";
import { Command, Option } from "clipanion";

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

  reportName = Option.String("--report-name,--name", {
    description: "The report name",
  });

  async execute() {
    const config = await resolveConfig({
      historyPath: this.historyPath ?? "history.jsonl",
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

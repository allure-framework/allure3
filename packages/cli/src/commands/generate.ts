import { AllureReport, readConfig } from "@allurereport/core";
import { KnownError } from "@allurereport/service";
import { Command, Option } from "clipanion";
import process from "node:process";
import { red } from "yoctocolors";
import { logError } from "../utils/logs.js";

export class GenerateCommand extends Command {
  static paths = [["generate"]];

  static usage = Command.Usage({
    description: "Generates the report to specified directory",
    details: "This command generates a report from the provided Allure Results directory.",
    examples: [
      ["generate ./allure-results", "Generate a report from the ./allure-results directory"],
      [
        "generate ./allure-results --output custom-report",
        "Generate a report from the ./allure-results directory to the custom-report directory",
      ],
    ],
  });

  resultsDir = Option.Rest({ required: 1, name: "The directory with Allure results" });

  config = Option.String("--config,-c", {
    description: "The path Allure config file",
  });

  output = Option.String("--output,-o", {
    description: "The output directory name. Absolute paths are accepted as well (default: allure-report)",
  });

  cwd = Option.String("--cwd", {
    description: "The working directory for the command to run (default: current working directory)",
  });

  reportName = Option.String("--report-name,--name", {
    description: "The report name",
  });

  async execute() {
    const config = await readConfig(this.cwd, this.config, {
      name: this.reportName,
      output: this.output ?? "allure-report",
    });

    try {
      const allureReport = new AllureReport(config);

      await allureReport.start();
      await allureReport.readDirectory(this.resultsDir[0]);
      await allureReport.done();
    } catch (error) {
      if (error instanceof KnownError) {
        // eslint-disable-next-line no-console
        console.error(red(error.message));
        process.exit(1);
        return;
      }

      await logError("Failed to generate report due to unexpected error", error as Error);
      process.exit(1);
    }
  }
}

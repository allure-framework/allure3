import { AllureReport, enforcePlugin, readConfig } from "@allurereport/core";
import CsvPlugin, { type CsvPluginOptions } from "@allurereport/plugin-csv";
import { Command, Option } from "clipanion";
import * as console from "node:console";
import { realpath } from "node:fs/promises";
import process from "node:process";

export class CsvCommand extends Command {
  static paths = [["csv"]];

  static usage = Command.Usage({
    category: "Reports",
    description: "Generates CSV report based on provided Allure Results",
    details: "This command generates a CSV report from the provided Allure Results directory.",
    examples: [
      ["csv ./allure-results", "Generate a report from the ./allure-results directory"],
      [
        "csv ./allure-results --output custom-report.csv",
        "Generate a report from the ./allure-results directory to the custom-report.csv file",
      ],
    ],
  });

  resultsDir = Option.String({ required: true, name: "The directory with Allure results" });

  config = Option.String("--config,-c", {
    description: "The path Allure config file",
  });

  cwd = Option.String("--cwd", {
    description: "The working directory for the command to run (default: current working directory)",
  });

  output = Option.String("--output,-o", {
    description: "The output file name. Absolute paths are accepted as well",
  });

  disableHeaders = Option.Boolean("--disable-headers", {
    description: "Specify, to disable CSV headers",
  });

  separator = Option.String("--separator", {
    description: "The csv separator",
  });

  knownIssues = Option.String("--known-issues", {
    description: "Path to the known issues file. Updates the file and quarantines failed tests when specified",
  });

  async execute() {
    const cwd = await realpath(this.cwd ?? process.cwd());
    const before = new Date().getTime();

    const defaultCsvOptions = {
      separator: this.separator ?? ",",
      disableHeaders: this.disableHeaders ?? false,
    } as CsvPluginOptions;

    const config = enforcePlugin(
      await readConfig(cwd, this.config, {
        output: this.output ?? "allure.csv",
        knownIssuesPath: this.knownIssues,
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
    await allureReport.readDirectory(this.resultsDir);
    await allureReport.done();

    const after = new Date().getTime();

    console.log(`the report successfully generated (${after - before}ms)`);
  }
}

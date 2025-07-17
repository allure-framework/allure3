import { AllureReport, enforcePlugin, readConfig } from "@allurereport/core";
import ClassicPlugin, { type ClassicPluginOptions } from "@allurereport/plugin-classic";
import { Command, Option } from "clipanion";
import * as console from "node:console";
import { realpath } from "node:fs/promises";
import process from "node:process";

export class ClassicCommand extends Command {
  static paths = [["classic"]];

  static usage = Command.Usage({
    category: "Reports",
    description: "Generates Allure Classic report based on provided Allure Results",
    details: "This command generates an Allure Classic report from the provided Allure Results directory.",
    examples: [
      ["classic ./allure-results", "Generate a report from the ./allure-results directory"],
      [
        "classic ./allure-results --output custom-report",
        "Generate a report from the ./allure-results directory to the custom-report directory",
      ],
    ],
  });

  resultsDir = Option.String({ required: true, name: "The directory with Allure results" });

  config = Option.String("--config,-c", {
    description: "The path Allure config file",
  });

  cwd = Option.String("--cwd", {
    description: "The working directory for the command to run (Default: current working directory)",
  });

  output = Option.String("--output,-o", {
    description: "The output directory name. Absolute paths are accepted as well",
  });

  reportName = Option.String("--report-name,--name", {
    description: "The report name",
  });

  reportLanguage = Option.String("--report-language,--lang", {
    description: "Default language of the report (default: OS language)",
  });

  singleFile = Option.Boolean("--single-file", {
    description: "Generate single file report",
  });

  historyPath = Option.String("--history-path,-h", {
    description: "The path to history file",
  });

  knownIssues = Option.String("--known-issues", {
    description: "Path to the known issues file. Updates the file and quarantines failed tests when specified",
  });

  async execute() {
    const cwd = await realpath(this.cwd ?? process.cwd());
    const before = new Date().getTime();

    const defaultClassicOptions = {
      singleFile: this.singleFile ?? false,
      reportLanguage: this.reportLanguage,
    } as ClassicPluginOptions;

    const config = enforcePlugin(
      await readConfig(cwd, this.config, {
        output: this.output ?? "allure-report",
        name: this.reportName ?? "Allure Report",
        knownIssuesPath: this.knownIssues,
        historyPath: this.historyPath,
      }),
      {
        id: "classic",
        enabled: true,
        options: defaultClassicOptions,
        plugin: new ClassicPlugin(defaultClassicOptions),
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

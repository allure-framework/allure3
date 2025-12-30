import { AllureReport, readConfig } from "@allurereport/core";
import Allure2Plugin, { type Allure2PluginOptions } from "@allurereport/plugin-allure2";
import { Command, Option } from "clipanion";
import * as console from "node:console";
import { existsSync } from "node:fs";
import { realpath } from "node:fs/promises";
import process, { exit } from "node:process";
import { red } from "yoctocolors";

export class Allure2Command extends Command {
  static paths = [["allure2"]];

  static usage = Command.Usage({
    category: "Reports",
    description: "Generates Allure Classic report based on provided Allure Results",
    details: "This command generates an Allure Classic report from the provided Allure Results directory.",
    examples: [
      ["allure2 ./allure-results", "Generate a report from the ./allure-results directory"],
      [
        "allure2 ./allure-results --output custom-report",
        "Generate a report from the ./allure-results directory to the custom-report directory",
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
    if (!existsSync(this.resultsDir)) {
      console.error(red(`The given test results directory doesn't exist: ${this.resultsDir}`));
      exit(1);
      return;
    }

    const cwd = await realpath(this.cwd ?? process.cwd());
    const before = new Date().getTime();
    const defaultAllure2Options = {
      singleFile: this.singleFile ?? false,
      reportLanguage: this.reportLanguage,
    } as Allure2PluginOptions;
    const config = await readConfig(cwd, this.config, {
      output: this.output,
      name: this.reportName,
      knownIssuesPath: this.knownIssues,
      historyPath: this.historyPath,
    });

    config.plugins = [
      {
        id: "allure2",
        enabled: true,
        options: defaultAllure2Options,
        plugin: new Allure2Plugin(defaultAllure2Options),
      },
    ];

    const allureReport = new AllureReport(config);

    await allureReport.start();
    await allureReport.readDirectory(this.resultsDir);
    await allureReport.done();

    const after = new Date().getTime();

    console.log(`the report successfully generated (${after - before}ms)`);
  }
}

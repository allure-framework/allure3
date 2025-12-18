import { AllureReport, readConfig } from "@allurereport/core";
import { default as AwesomePlugin, type AwesomePluginOptions } from "@allurereport/plugin-awesome";
import { Command, Option } from "clipanion";
import * as console from "node:console";
import { existsSync } from "node:fs";
import { realpath } from "node:fs/promises";
import process, { exit } from "node:process";
import { red } from "yoctocolors";

export class AwesomeCommand extends Command {
  static paths = [["awesome"]];

  static usage = Command.Usage({
    category: "Reports",
    description: "Generates Allure Awesome report based on provided Allure Results",
    details: "This command generates an Allure Awesome report from the provided Allure Results directory.",
    examples: [
      ["awesome ./allure-results", "Generate a report from the ./allure-results directory"],
      [
        "awesome ./allure-results --output custom-report",
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

  singleFile = Option.Boolean("--single-file", {
    description: "Generate single file report",
  });

  logo = Option.String("--logo", {
    description: "Path to the report logo which will be displayed in the header",
  });

  theme = Option.String("--theme", {
    description: "Default theme of the report (default: OS theme)",
  });

  reportLanguage = Option.String("--report-language,--lang", {
    description: "Default language of the report (default: OS language)",
  });

  historyPath = Option.String("--history-path,-h", {
    description: "The path to history file",
  });

  knownIssues = Option.String("--known-issues", {
    description: "Path to the known issues file. Updates the file and quarantines failed tests when specified",
  });

  groupBy = Option.String("--group-by,-g", {
    description: "Group test results by labels. The labels should be separated by commas",
  });

  async execute() {
    if (!existsSync(this.resultsDir)) {
      console.error(red(`The given test results directory doesn't exist: ${this.resultsDir}`));
      exit(1);
      return;
    }

    const cwd = await realpath(this.cwd ?? process.cwd());
    const before = new Date().getTime();
    const defaultAwesomeOptions = {
      singleFile: this.singleFile ?? false,
      logo: this.logo,
      theme: this.theme,
      reportLanguage: this.reportLanguage,
      groupBy: this.groupBy?.split?.(",") ?? ["parentSuite", "suite", "subSuite"],
    } as AwesomePluginOptions;
    const config = await readConfig(cwd, this.config, {
      output: this.output,
      name: this.reportName,
      knownIssuesPath: this.knownIssues,
      historyPath: this.historyPath,
    });

    config.plugins = [
      {
        id: "awesome",
        enabled: true,
        options: defaultAwesomeOptions,
        plugin: new AwesomePlugin(defaultAwesomeOptions),
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

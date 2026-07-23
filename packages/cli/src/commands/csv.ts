import * as console from "node:console";
import { realpath } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import process, { exit } from "node:process";

import { AllureReport, readConfig } from "@allurereport/core";
import CsvPlugin, { type CsvPluginOptions } from "@allurereport/plugin-csv";
import { Command, Option } from "clipanion";
import { red } from "yoctocolors";

import { findAllureResultDirectories } from "../utils/fileSystem.js";

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
      ["csv ./packages/*/allure-results", "Generate a report from all Allure result directories matching the pattern"],
      [
        "csv ./packages/foo/allure-results ./packages/bar/allure-results",
        "Generate a report from two Allure result directories",
      ],
    ],
  });

  resultsDir = Option.Rest({
    name: "Patterns to match test results directories in the current working directory (default: ./**/allure-results)",
  });

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
    description: "Path to known issues file. Read-only; quarantine is controlled separately",
  });

  quarantine = Option.String("--quarantine", {
    description: "Path to quarantine file. Read/write quarantine issues only",
  });

  async execute() {
    const cwd = await realpath(this.cwd ?? process.cwd());

    const { resultDirectories, patterns } = await findAllureResultDirectories(cwd, this.resultsDir);
    if (!resultDirectories.length) {
      console.error(red(`No test results directories found matching pattern: ${patterns}`));
      exit(1);
      return;
    }

    const before = new Date().getTime();
    const defaultCsvOptions = {
      separator: this.separator ?? ",",
      disableHeaders: this.disableHeaders ?? false,
      // it's a UX improvement: use absolute path to write file directly, avoiding report's output directory
      fileName: this.output && isAbsolute(this.output) ? this.output : this.output ? join(cwd, this.output) : undefined,
    } as CsvPluginOptions;
    const config = await readConfig(cwd, this.config, {
      knownIssuesPath: this.knownIssues,
      quarantinePath: this.quarantine,
    });

    config.plugins = [
      {
        id: "csv",
        enabled: true,
        options: defaultCsvOptions,
        plugin: new CsvPlugin(defaultCsvOptions),
      },
    ];

    const allureReport = new AllureReport(config);

    await allureReport.start();

    for (const directory of resultDirectories) {
      await allureReport.readDirectory(directory);
    }

    await allureReport.done();

    const after = new Date().getTime();

    console.log(`the report successfully generated (${after - before}ms)`);
  }
}

import { AllureReport, readConfig } from "@allurereport/core";
import LogPlugin, { type LogPluginOptions } from "@allurereport/plugin-log";
import { Command, Option } from "clipanion";
import * as console from "node:console";
import { existsSync } from "node:fs";
import { realpath } from "node:fs/promises";
import process, { exit } from "node:process";
import { red } from "yoctocolors";

export class LogCommand extends Command {
  static paths = [["log"]];

  static usage = Command.Usage({
    category: "Reports",
    description: "Prints Allure Results to the console",
    details: "This command prints Allure Results to the console from the provided Allure Results directory.",
    examples: [
      ["log ./allure-results", "Print results from the ./allure-results directory"],
      [
        "log ./allure-results --all-steps --with-trace",
        "Print results with all steps and stack traces from the ./allure-results directory",
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

  groupBy = Option.String("--group-by", {
    description: "Group tests by type (none, suite, feature, package, etc.)",
  });

  allSteps = Option.Boolean("--all-steps", {
    description: "Show all steps. By default only failed steps are shown",
  });

  withTrace = Option.Boolean("--with-trace", {
    description: "Print stack trace for failed tests",
  });

  async execute() {
    if (!existsSync(this.resultsDir)) {
      console.error(red(`Given test results directory doesn't exist: ${this.resultsDir}`));
      exit(1);
      return;
    }

    const cwd = await realpath(this.cwd ?? process.cwd());
    const before = new Date().getTime();
    const defaultLogOptions = {
      allSteps: this.allSteps ?? false,
      withTrace: this.withTrace ?? false,
      groupBy: this.groupBy ?? "suite",
    } as LogPluginOptions;
    const config = await readConfig(cwd, this.config);

    config.plugins = [
      {
        id: "log",
        enabled: true,
        options: defaultLogOptions,
        plugin: new LogPlugin(defaultLogOptions),
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

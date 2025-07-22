import { AllureReport, readConfig } from "@allurereport/core";
import { Command, Option } from "clipanion";
import * as console from "node:console";
import { exit } from "node:process";
import { bold, red } from "yoctocolors";

export class QualityGateCommand extends Command {
  static paths = [["quality-gate"]];

  static usage = Command.Usage({
    description: "Returns status code 1 if there any test failure above specified success rate",
    details: "This command validates the test results against quality gates defined in the configuration.",
    examples: [
      ["quality-gate ./allure-results", "Validate the test results in the ./allure-results directory"],
      [
        "quality-gate ./allure-results --config custom-config.js",
        "Validate the test results using a custom configuration file",
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

  async execute() {
    const fullConfig = await readConfig(this.cwd, this.config);
    const allureReport = new AllureReport(fullConfig);

    await allureReport.start();
    await allureReport.readDirectory(this.resultsDir);
    await allureReport.done();
    await allureReport.validate();

    if (allureReport.exitCode === 0) {
      return;
    }

    const failedResults = allureReport.validationResults.filter((result) => !result.success);

    console.error(red(`Quality gate has failed with ${bold(failedResults.length.toString())} errors:\n`));

    for (const result of failedResults) {
      let scope = "";

      switch (result.meta?.type) {
        case "label":
          scope = `(label[${result.meta.name}="${result.meta.value}"])`;
          break;
        case "parameter":
          scope = `(parameter[${result.meta.name}="${result.meta.value}"])`;
          break;
      }

      console.error(red(`⨯ ${bold(`${result.rule}${scope}`)}: expected ${result.expected}, actual ${result.actual}`));
    }

    console.error(red("\nThe process has been exited with code 1"));

    exit(allureReport.exitCode);
  }
}

import { AllureReport, readConfig, runQualityGate, stringifyQualityGateResults } from "@allurereport/core";
import { Command, Option } from "clipanion";
import * as console from "node:console";
import { exit } from "node:process";
import { red } from "yoctocolors";

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

    if (!fullConfig.qualityGate) {
      console.error(red("Quality gate is not configured"));
      exit(1);
      return;
    }

    const allureReport = new AllureReport(fullConfig);

    await allureReport.start();
    await allureReport.readDirectory(this.resultsDir);
    await allureReport.done();

    const results = await runQualityGate(allureReport.store, fullConfig.qualityGate);

    if (results.length === 0) {
      exit(0);
      return;
    }

    console.error(stringifyQualityGateResults(results));

    exit(1);
  }
}

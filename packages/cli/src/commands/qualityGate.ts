import {AllureReport, enforcePlugin, readConfig} from "@allurereport/core";
import { Command, Option } from "clipanion";
import QualityGatePlugin from "@allurereport/plugin-quality-gate"
import * as typanion from "typanion";
import * as console from "node:console";
import { exit } from "node:process";
import { red } from "yoctocolors";
import {realpath} from "node:fs/promises";

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

  forceFail = Option.Boolean("--force-fail", {
    description: "Force the command to fail if there are any rule failures",
  });

  maxFailures = Option.String("--max-failures", {
    description: "The maximum number of rule failures to allow before failing the command",
    validator: typanion.isNumber(),
  });

  minTestsCount = Option.String("--min-tests-count", {
    description: "The minimum number of tests to run before validating the quality gate",
    validator: typanion.isNumber(),
  });

  successRate = Option.String("--success-rate", {
    description: "The minimum success rate to allow before failing the command",
    validator: typanion.isNumber(),
  });

  knownIssues = Option.String("--known-issues", {
    description: "Path to the known issues file. Updates the file and quarantines failed tests when specified",
  });

  cwd = Option.String("--cwd", {
    description: "The working directory for the command to run (default: current working directory)",
  });

  async execute() {
    const { maxFailures, minTestsCount, successRate, forceFail, knownIssues } = this;
    const cwd = await realpath(this.cwd ?? process.cwd());
    const fullConfig = await readConfig(this.cwd, this.config);
    const rules: Record<string, any> = {}

    if (maxFailures !== undefined) {
      rules.maxFailures = maxFailures;
    }

    if (minTestsCount !== undefined) {
      rules.minTestsCount = minTestsCount;
    }

    if (successRate !== undefined) {
      rules.successRate = successRate;
    }

    const defaultQualityGateOptions = {
      rules: [
        {
          forceFail,
          rules,
        }
      ]
    }
    const config = enforcePlugin(
      await readConfig(cwd, this.config, {
        knownIssuesPath: this.knownIssues,
      }),
      {
        id: "quality-gate",
        enabled: true,
        options: defaultQualityGateOptions,
        plugin: new QualityGatePlugin(defaultQualityGateOptions),
      },
    );
    const allureReport = new AllureReport(config);

    // TODO:
    // allureReport.realtimeSubscriber.onGlobalError(() => {
    //
    // })

    await allureReport.start();
    await allureReport.readDirectory(this.resultsDir);
    await allureReport.done();

    // const results = await runQualityGate(allureReport.store, fullConfig.qualityGate);
    //
    // if (results.length === 0) {
    //   exit(0);
    //   return;
    // }
    //
    // console.error(stringifyQualityGateResults(results));
    //
    // exit(1);
  }
}

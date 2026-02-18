import { AllureReport, QualityGateState, readConfig, stringifyQualityGateResults } from "@allurereport/core";
import type { TestResult } from "@allurereport/core-api";
import { Command, Option } from "clipanion";
import { glob } from "glob";
import * as console from "node:console";
import { realpath } from "node:fs/promises";
import { exit, cwd as processCwd } from "node:process";
import * as typanion from "typanion";
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

  resultsDir = Option.String({
    required: false,
    name: "Pattern to match test results directories in the current working directory (default: ./**/allure-results)",
  });

  config = Option.String("--config,-c", {
    description: "The path Allure config file",
  });

  fastFail = Option.Boolean("--fast-fail", {
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

  environment = Option.String("--environment,--env", {
    description:
      "Force specific environment to all tests in the run. Given environment has higher priority than the one defined in the config file (default: empty string)",
  });

  cwd = Option.String("--cwd", {
    description: "The working directory for the command to run (default: current working directory)",
  });

  async execute() {
    const cwd = await realpath(this.cwd ?? processCwd());
    const resultsDir = (this.resultsDir ?? "./**/allure-results").replace(/[\\/]$/, "");
    const { maxFailures, minTestsCount, successRate, fastFail, knownIssues: knownIssuesPath, environment } = this;
    const config = await readConfig(cwd, this.config, {
      knownIssuesPath,
    });
    const rules: Record<string, any> = {};

    if (maxFailures !== undefined) {
      rules.maxFailures = maxFailures;
    }

    if (minTestsCount !== undefined) {
      rules.minTestsCount = minTestsCount;
    }

    if (successRate !== undefined) {
      rules.successRate = successRate;
    }

    if (fastFail) {
      rules.fastFail = fastFail;
    }

    config.plugins = [];

    // prioritize the cli options
    if (Object.keys(rules).length > 0) {
      config.qualityGate = {
        rules: [rules],
      };
    }

    const allureReport = new AllureReport(config);

    if (!allureReport.hasQualityGate) {
      // eslint-disable-next-line no-console
      console.error(red("Quality gate is not configured!"));
      console.error(
        red(
          "Add qualityGate to the config or consult help to know, how to use the command with command-line arguments",
        ),
      );
      exit(-1);
      return;
    }

    const resultsDirectories = (
      await glob(resultsDir, {
        mark: true,
        nodir: false,
        absolute: true,
        dot: true,
        windowsPathsNoEscape: true,
        cwd,
      })
    ).filter((p) => /(\/|\\)$/.test(p));

    if (resultsDirectories.length === 0) {
      // eslint-disable-next-line no-console
      console.error(red(`No test results directories found matching pattern: ${resultsDir}`));
      exit(1);
      return;
    }

    const knownIssues = await allureReport.store.allKnownIssues();
    const state = new QualityGateState();

    allureReport.realtimeSubscriber.onTestResults(async (trsIds) => {
      const trs = await Promise.all(trsIds.map((id) => allureReport.store.testResultById(id)));
      const notHiddenTrs = (trs as TestResult[]).filter((tr) => !tr.hidden);
      const { results, fastFailed } = await allureReport.validate({
        trs: notHiddenTrs,
        environment,
        knownIssues,
        state,
      });

      if (!fastFailed) {
        return;
      }

      // eslint-disable-next-line no-console
      console.error(stringifyQualityGateResults(results));

      exit(1);
    });

    await allureReport.start();

    for (const dir of resultsDirectories) {
      await allureReport.readDirectory(dir);
    }

    await allureReport.done();

    const allTrs = await allureReport.store.allTestResults({ includeHidden: false });
    const validationResults = await allureReport.validate({
      trs: allTrs,
      knownIssues,
      environment,
    });

    if (validationResults.results.length === 0) {
      exit(0);
      return;
    }

    // eslint-disable-next-line no-console
    console.error(stringifyQualityGateResults(validationResults.results));

    exit(1);
  }
}

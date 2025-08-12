import { AllureReport, QualityGateState, readConfig, stringifyQualityGateResults } from "@allurereport/core";
import { TestResult } from "@allurereport/core-api";
import { findMatching } from "@allurereport/directory-watcher";
import { Command, Option } from "clipanion";
import { realpath } from "node:fs/promises";
import { exit } from "node:process";
import process from "node:process";
import * as typanion from "typanion";

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

  resultsDir = Option.String({ required: false, name: "The directory with Allure results" });

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

  cwd = Option.String("--cwd", {
    description: "The working directory for the command to run (default: current working directory)",
  });

  async execute() {
    const cwd = await realpath(this.cwd ?? process.cwd());
    const targetDir = this?.resultsDir ?? cwd;
    const { maxFailures, minTestsCount, successRate, fastFail, knownIssues } = this;
    const config = await readConfig(cwd, this.config, {
      knownIssuesPath: knownIssues,
    });
    const rules: Record<string, any> = {};
    const resultsDirs = new Set<string>();

    if (!this.resultsDir) {
      await findMatching(targetDir, resultsDirs, (dirent) => dirent.isDirectory() && dirent.name === "allure-results");
    } else {
      resultsDirs.add(this.resultsDir);
    }

    if (resultsDirs.size === 0) {
      // eslint-disable-next-line no-console
      console.error("No Allure results directories found");
      exit(0);
      return;
    }

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

    const qualityGateCliRules = {
      ...rules,
    };

    config.plugins = [];

    if (config.qualityGate) {
      config.qualityGate.rules?.push(qualityGateCliRules);
    } else if (Object.keys(qualityGateCliRules).length > 0) {
      config.qualityGate = {
        rules: [qualityGateCliRules],
      };
    }

    const allureReport = new AllureReport(config);

    if (!allureReport.hasQualityGate) {
      console.info("Quality gate is not configured");
      exit(0);
      return;
    }

    const state = new QualityGateState();

    allureReport.realtimeSubscriber.onTestResults(async (trsIds) => {
      const trs = await Promise.all(trsIds.map((id) => allureReport.store.testResultById(id)));
      const { results, fastFailed } = await allureReport.validate(trs as TestResult[], state);

      if (!fastFailed) {
        return;
      }

      const qualityGateMessage = stringifyQualityGateResults(results);

      console.error(qualityGateMessage);

      exit(1);
    });

    await allureReport.start();

    for (const resultsDir of resultsDirs) {
      await allureReport.readDirectory(resultsDir);
    }

    await allureReport.done();

    const allTrs = await allureReport.store.allTestResults();
    const { results } = await allureReport.validate(allTrs);


    if (results.length === 0) {
      exit(0);
      return;
    }

    const qualityGateMessage = stringifyQualityGateResults(results);

    console.error(qualityGateMessage);

    exit(1);
  }
}

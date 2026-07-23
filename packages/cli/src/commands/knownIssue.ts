import * as console from "node:console";
import { resolve } from "node:path";
import process, { exit } from "node:process";

import { AllureReport, resolveConfig, writeKnownIssues } from "@allurereport/core";
import { Command, Option } from "clipanion";
import { red } from "yoctocolors";

import { findAllureResultDirectories } from "../utils/fileSystem.js";

export class KnownIssueCommand extends Command {
  static paths = [["known-issue"]];

  static usage = Command.Usage({
    description: "Generates a known issue list",
    details: "This command generates a known issue list from the provided Allure Results directory.",
    examples: [
      ["known-issue ./allure-results", "Generate a known issue list from the ./allure-results directory"],
      [
        "known-issue ./allure-results --output custom-issues.json",
        "Generate a known issue list from the ./allure-results directory to the custom-issues.json file",
      ],
      [
        "known-issue ./packages/*/allure-results",
        "Generate a known issue list from all Allure result directories matching the pattern",
      ],
      [
        "known-issue ./packages/foo/allure-results ./packages/bar/allure-results",
        "Generate a known issue list from two Allure result directories",
      ],
    ],
  });

  resultsDir = Option.Rest({
    name: "Patterns to match test results directories in the current working directory (default: ./**/allure-results)",
  });

  output = Option.String("--output,-o", {
    description: "The output file name. Absolute paths are accepted as well",
  });

  async execute() {
    const { resultDirectories, patterns } = await findAllureResultDirectories(process.cwd(), this.resultsDir);
    if (!resultDirectories.length) {
      console.error(red(`No test results directories found matching pattern: ${patterns}`));
      exit(1);
      return;
    }

    const outputPath = this.output ?? "known-issues.json";
    const config = await resolveConfig({
      plugins: {},
      knownIssuesPath: "",
      quarantinePath: "",
    });
    const allureReport = new AllureReport(config);

    await allureReport.start();

    for (const directory of resultDirectories) {
      await allureReport.readDirectory(directory);
    }

    await allureReport.done();

    const targetPath = resolve(outputPath);

    await writeKnownIssues(allureReport.store, outputPath);

    console.log(`writing known-issues.json to ${targetPath}`);
  }
}

import * as console from "node:console";
import { basename, dirname, resolve } from "node:path";
import { exit } from "node:process";

import { AllureReport, resolveConfig } from "@allurereport/core";
import { Command, Option } from "clipanion";
import { red } from "yoctocolors";

import { searchAllureResultDirectories } from "../utils/fileSystem.js";

export class TestPlanCommand extends Command {
  static paths = [["testplan"]];

  static usage = Command.Usage({
    description: "Generates testplan.json based on provided Allure Results",
    details: "This command generates a testplan.json file from the provided Allure Results directory.",
    examples: [
      ["testplan ./allure-results", "Generate a testplan.json file from the ./allure-results directory"],
      [
        "testplan ./allure-results --output custom-testplan.json",
        "Generate a custom-testplan.json file from the ./allure-results directory",
      ],
      [
        "testplan ./packages/*/allure-results",
        "Generate a testplan.json file from all Allure result directories matching the pattern",
      ],
      [
        "testplan ./packages/foo/allure-results ./packages/bar/allure-results",
        "Generate a testplan.json file from two Allure result directories",
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
    const { resultDirectories, patterns } = await searchAllureResultDirectories(process.cwd(), this.resultsDir);
    if (!resultDirectories.length) {
      console.error(red(`No test results directories found matching pattern: ${patterns}`));
      exit(1);
      return;
    }

    const before = new Date().getTime();
    const resolved = resolve(this.output ?? "./testplan.json");
    const output = dirname(resolved);
    const fileName = basename(resolved);
    const config = await resolveConfig({
      output: output,
      plugins: {
        "@allurereport/plugin-testplan": {
          options: { fileName },
        },
      },
    });

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

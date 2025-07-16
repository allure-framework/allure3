import { AllureReport, resolveConfig } from "@allurereport/core";
import { Command, Option } from "clipanion";
import * as console from "node:console";
import { basename, dirname, resolve } from "node:path";

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
    ],
  });

  resultsDir = Option.Rest({ required: 1, name: "The directory with Allure results" });

  output = Option.String("--output,-o", {
    description: "The output file name. Absolute paths are accepted as well",
  });

  async execute() {
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
    await allureReport.readDirectory(this.resultsDir[0]);
    await allureReport.done();

    const after = new Date().getTime();

    console.log(`the report successfully generated (${after - before}ms)`);
  }
}

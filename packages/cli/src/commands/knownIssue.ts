import { AllureReport, resolveConfig, writeKnownIssues } from "@allurereport/core";
import { Command, Option } from "clipanion";
import console from "node:console";
import { resolve } from "node:path";

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
    ],
  });

  resultsDir = Option.String({ required: true, name: "The directory with Allure results" });

  output = Option.String("--output,-o", {
    description: "The output file name. Absolute paths are accepted as well",
  });

  async execute() {
    const outputPath = this.output ?? "known-issues.json";
    const config = await resolveConfig({
      plugins: {},
    });
    const allureReport = new AllureReport(config);

    await allureReport.start();
    await allureReport.readDirectory(this.resultsDir);
    await allureReport.done();

    const targetPath = resolve(outputPath);

    await writeKnownIssues(allureReport.store, outputPath);

    console.log(`writing known-issues.json to ${targetPath}`);
  }
}

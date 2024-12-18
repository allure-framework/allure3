import { AllureReport, resolveConfig, writeKnownIssues } from "@allurereport/core";
import console from "node:console";
import { resolve } from "node:path";
import { createCommand } from "../utils/commands.js";

type CommandOptions = {
  output?: string;
};

export const KnownIssueCommandAction = async (resultsDir: string, options: CommandOptions) => {
  const { output = "known-issues.json" } = options;
  const config = await resolveConfig({
    plugins: {},
  });

  const allureReport = new AllureReport(config);

  await allureReport.start();
  await allureReport.readDirectory(resultsDir);
  await allureReport.done();

  const targetPath = resolve(output);
  await writeKnownIssues(allureReport.store, output);

  console.log(`writing known-issues.json to ${targetPath}`);
};

export const KnownIssueCommand = createCommand({
  name: "known-issue <resultsDir>",
  description: "Generates a known issue list",
  options: [
    [
      "--output, -o <file>",
      {
        description: "The output file name. Absolute paths are accepted as well",
        default: "known-issues.json",
      },
    ],
  ],
  action: KnownIssueCommandAction,
});

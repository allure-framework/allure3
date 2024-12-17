import { AllureReport, resolveConfig } from "@allurereport/core";
import * as console from "node:console";
import { basename, dirname, resolve } from "node:path";
import { createCommand } from "../utils/commands.js";

type CommandOptions = {
  output?: string;
};

export const TestPlanCommandAction = async (resultsDir: string, options: CommandOptions) => {
  const before = new Date().getTime();
  const resolved = resolve(options.output ?? "./testplan.json");
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
  await allureReport.readDirectory(resultsDir);
  await allureReport.done();

  const after = new Date().getTime();

  console.log(`the report successfully generated (${after - before}ms)`);
};

export const TestPlanCommand = createCommand({
  name: "testplan <resultsDir>",
  description: "Generates testplan.json based on provided Allure Results",
  options: [
    [
      "--output, -o <file>",
      {
        description: "The output file name. Absolute paths are accepted as well",
        default: "testplan.json",
      },
    ],
  ],
  action: TestPlanCommandAction,
});

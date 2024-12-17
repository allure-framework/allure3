import { AllureReport, readRuntimeConfig } from "@allurereport/core";
import console from "node:console";
import process from "node:process";
import { bold, red } from "yoctocolors";
import { createCommand } from "../utils/commands.js";

type QualityGateCommandOptions = {
  cwd?: string;
};

export const QualityGateCommandAction = async (resultsDir: string, options: QualityGateCommandOptions) => {
  const cwd = options.cwd ?? process.cwd();
  const fullConfig = await readRuntimeConfig(cwd, "./allure-report");
  const allureReport = new AllureReport(fullConfig);

  await allureReport.start();
  await allureReport.readDirectory(resultsDir);
  await allureReport.done();

  await allureReport.validate();

  if (allureReport.exitCode === 0) {
    return;
  }

  const failedResults = allureReport.validationResults.filter((result) => !result.success);

  console.error(red(`Quality gate has failed with ${bold(failedResults.length.toString())} errors:\n`));

  for (const result of failedResults) {
    let scope = "";

    switch (result.meta?.type) {
      case "label":
        scope = `(label[${result.meta.name}="${result.meta.value}"])`;
        break;
      case "parameter":
        scope = `(parameter[${result.meta.name}="${result.meta.value}"])`;
        break;
    }

    console.error(red(`⨯ ${bold(`${result.rule}${scope}`)}: expected ${result.expected}, actual ${result.actual}`));
  }

  console.error(red("\nThe process has been exited with code 1"));

  process.exit(allureReport.exitCode);
};

export const QualityGateCommand = createCommand({
  name: "quality-gate <resultsDir>",
  description: "Returns status code 1 if there any test failure above specified success rate",
  options: [
    [
      "--cwd <cwd>",
      {
        description: "The working directory for the command to run (default: current working directory)",
      },
    ],
  ],
  action: QualityGateCommandAction,
});

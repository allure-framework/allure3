import { AllureReport, readConfig } from "@allurereport/core";
import { KnownError } from "@allurereport/service";
import { red } from "yoctocolors";
import { createCommand } from "../utils/commands.js";
import { logError } from "../utils/logs.js";

type CommandOptions = {
  config?: string;
  output?: string;
  cwd?: string;
  reportName?: string;
};

export const GenerateCommandAction = async (resultsDir: string, options: CommandOptions) => {
  const { config: configPath, output, cwd, reportName } = options;
  const config = await readConfig(cwd, configPath, { name: reportName, output });

  try {
    const allureReport = new AllureReport(config);

    await allureReport.start();
    await allureReport.readDirectory(resultsDir);
    await allureReport.done();
  } catch (error) {
    if (error instanceof KnownError) {
      // eslint-disable-next-line no-console
      console.error(red(error.message));
      process.exit(1);
      return;
    }

    await logError("Failed to generate report due to unexpected error", error as Error);
    process.exit(1);
  }
};

export const GenerateCommand = createCommand({
  name: "generate <resultsDir>",
  description: "Generates the report to specified directory",
  options: [
    [
      "--config, -c <file>",
      {
        description: "The path Allure config file",
      },
    ],
    [
      "--output, -o <file>",
      {
        description: "The output directory name. Absolute paths are accepted as well (default: allure-report)",
      },
    ],
    [
      "--cwd <cwd>",
      {
        description: "The working directory for the command to run (default: current working directory)",
      },
    ],
  ],
  action: GenerateCommandAction,
});

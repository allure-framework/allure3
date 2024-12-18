import { AllureReport, readConfig } from "@allurereport/core";
import { createCommand } from "../utils/commands.js";

type CommandOptions = {
  config?: string;
  output?: string;
  cwd?: string;
  reportName?: string;
};

export const GenerateCommandAction = async (resultsDir: string, options: CommandOptions) => {
  const { config: configPath, output, cwd, reportName } = options;
  const config = await readConfig(cwd, configPath, { name: reportName, output });
  const allureReport = new AllureReport(config);

  await allureReport.start();
  await allureReport.readDirectory(resultsDir);
  await allureReport.done();
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

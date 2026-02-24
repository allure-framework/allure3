import { readConfig } from "@allurereport/core";
import { serve } from "@allurereport/static-server";
import { Command, Option } from "clipanion";
import { cwd as processCwd } from "node:process";
import { generate } from "./commons/generate.js";

export class GenerateCommand extends Command {
  static paths = [["generate"]];

  static usage = Command.Usage({
    description: "Generates the report to specified directory",
    details: "This command generates a report from the provided Allure Results directory.",
    examples: [
      ["generate ./allure-results", "Generate a report from the ./allure-results directory"],
      [
        "generate ./allure-results --output custom-report",
        "Generate a report from the ./allure-results directory to the custom-report directory",
      ],
      [
        "generate --dump=windows.zip --dump=macos.zip ./allure-results",
        "Generate a report using data from windows.zip and macos.zip archives and using results from the ./allure-results directory",
      ],
      [
        "generate --dump=allure-*.zip",
        "Generate a report using data from any dump archive that matches the given pattern and results directory if it exists",
      ],
    ],
  });

  resultsDir = Option.String({
    required: false,
    name: "Pattern to match test results directories in the current working directory (default: ./**/allure-results)",
  });

  config = Option.String("--config,-c", {
    description: "The path Allure config file",
  });

  output = Option.String("--output,-o", {
    description: "The output directory name. Absolute paths are accepted as well (default: allure-report)",
  });

  cwd = Option.String("--cwd", {
    description: "The working directory for the command to run (default: current working directory)",
  });

  reportName = Option.String("--report-name,--name", {
    description: "The report name (default: Allure Report)",
  });

  dump = Option.Array("--dump", {
    description: "Dump archives to restore state from (default: empty string)",
  });

  open = Option.Boolean("--open", {
    description: "Open the report in the default browser after generation (default: false)",
  });

  port = Option.String("--port", {
    description: "The port to serve the reports on. If not set, the server starts on a random port",
  });

  historyLimit = Option.String("--history-limit", {
    description: "Limits the number of history entries to keep (default: unlimited)",
  });

  async execute() {
    const cwd = this.cwd ?? processCwd();
    const config = await readConfig(cwd, this.config, {
      name: this.reportName,
      output: this.output,
      open: this.open,
      port: this.port,
      historyLimit: this.historyLimit ? parseInt(this.historyLimit, 10) : undefined,
    });

    await generate({
      dump: this.dump,
      resultsDir: this.resultsDir ?? "./**/allure-results",
      cwd,
      config,
    });

    if (config.open) {
      await serve({
        port: config.port ? parseInt(config.port, 10) : undefined,
        servePath: config.output,
        open: true,
      });
    }
  }
}

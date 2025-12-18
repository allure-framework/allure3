import { readConfig } from "@allurereport/core";
import { serve } from "@allurereport/static-server";
import { Command, Option } from "clipanion";
import { cwd as processCwd } from "node:process";
import { generate } from "./commons/generate.js";

export class OpenCommand extends Command {
  static paths = [["open"], ["serve"]];

  static usage = Command.Usage({
    description: "Serves specified directory",
    details: "This command generates report with the given test results and opens it in the default browser.",
    examples: [
      ["open", "Generate and serve the report based on default test results directories"],
      ["open ./allure-results", "Generate and serve the report based on given test results directory"],
      ["open --port 8080 ./allure-results", "Serve the report on port 8080"],
    ],
  });

  resultsDir = Option.String({
    required: false,
    name: "Pattern to match test results directories in the current working directory (default: ./**/allure-results)",
  });

  output = Option.String("--output,-o", {
    description: "The output directory name. Absolute paths are accepted as well (default: allure-report)",
  });

  config = Option.String("--config,-c", {
    description: "The path Allure config file",
  });

  port = Option.String("--port", {
    description: "The port to serve the reports on. If not set, the server starts on a random port",
  });

  cwd = Option.String("--cwd", {
    description: "The working directory for the command to run (default: current working directory)",
  });

  async execute() {
    const cwd = this.cwd ?? processCwd();
    const config = await readConfig(cwd, this.config, {
      output: this.output,
      port: this.port,
    });

    await generate({
      resultsDir: this.resultsDir ?? "./**/allure-results",
      cwd,
      config,
    });
    await serve({
      port: config.port ? parseInt(config.port, 10) : undefined,
      servePath: config.output,
      open: true,
    });
  }
}

import { cwd as processCwd } from "node:process";

import { readConfig } from "@allurereport/core";
import { serve } from "@allurereport/static-server";
import { Command, Option } from "clipanion";

import { generate } from "./commons/generate.js";

export class GenerateCommand extends Command {
  static paths = [["generate"]];

  static usage = Command.Usage({
    description: "Generates the report in the specified directory.",
    details:
      "This command generates a report from the provided Allure Results directories. " +
      "When a quality gate is configured, the command validates the loaded results and finishes writing the report or dump before returning its status.",
    examples: [
      ["generate ./allure-results", "Generate a report from the ./allure-results directory"],
      [
        "generate ./allure-results --output custom-report",
        "Generate a report from the ./allure-results directory to the custom-report directory",
      ],
      [
        "generate ./allure-results --clean",
        "Remove the existing report directory before generating a fresh report from ./allure-results",
      ],
      [
        "generate --dump=windows.zip --dump=macos.zip ./allure-results",
        "Generate a report using data from windows.zip and macos.zip archives and using results from the ./allure-results directory",
      ],
      [
        "generate --dump=allure-*.zip",
        "Generate a report using data from any dump archive that matches the given pattern and results directory if it exists",
      ],
      [
        "generate ./packages/foo/out/allure-results ./packages/bar/out/allure-results",
        "Generate a report from two Allure results directories",
      ],
    ],
  });

  resultsDir = Option.Rest({
    name: "Patterns to match test results directories. Overrides config.resultsDir. Defaults to ./**/allure-results when neither is set.",
  });

  config = Option.String("--config,-c", {
    description: "The path to Allure config file",
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
    description:
      "Path or pattern that matches one or more archives created by `allure run --dump ...`. " +
      "Allure loads the matched archives before generating the report. " +
      "This option can be specified multiple times.",
  });

  clean = Option.Boolean("--clean", {
    description:
      "Remove the output directory before generating the report (default: false). " +
      "Refuses to remove the working directory, the home directory, a filesystem root, or the results directories",
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

  historyBaseUrl = Option.String("--history-base-url", {
    description: "The public base URL of the generated report directory",
  });

  hideLabels = Option.Array("--hide-labels", {
    description: "Hide labels by exact name in generated reports. Repeat the option for multiple labels",
  });

  knownIssues = Option.String("--known-issues", {
    description:
      "Path to known issues file. " +
      "Allure loads the file and updates it every time with the actual resolutions data of type `issue`",
  });

  async execute() {
    const cwd = this.cwd ?? processCwd();
    const hideLabels = this.hideLabels?.length ? this.hideLabels : undefined;
    const config = await readConfig(cwd, this.config, {
      name: this.reportName,
      output: this.output,
      open: this.open,
      port: this.port,
      hideLabels,
      historyLimit: this.historyLimit !== undefined ? parseInt(this.historyLimit, 10) : undefined,
      ...(this.historyBaseUrl !== undefined ? { historyBaseUrl: this.historyBaseUrl } : {}),
      resolutions: { knownIssuesPath: this.knownIssues },
    });

    const result = await generate({
      dump: this.dump,
      resultsDir: this.resultsDir,
      cwd,
      config,
      clean: this.clean,
    });

    if (!result) {
      return;
    }

    if (config.open) {
      await serve({
        port: config.port ? parseInt(config.port, 10) : undefined,
        servePath: config.output,
        open: true,
      });
    }

    return result.exitCode;
  }
}

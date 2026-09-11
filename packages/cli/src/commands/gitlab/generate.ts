import { cwd as processCwd } from "node:process";

import { readConfig } from "@allurereport/core";
import { Command, Option } from "clipanion";

import { generate } from "../commons/generate.js";

export class GitlabGenerateCommand extends Command {
  static paths = [["gitlab", "generate"]];

  static usage = Command.Usage({
    category: "Integrations",
    description: "Generate test report and post report summary in merge request comments",
    details:
      "This command generates a report from the provided Allure Results directories. When api access token is configured, " +
      "integration will post summary as comment for merge request pipelines and attempt to lookup history file from previously executed job.",
    examples: [["gitlab publish ./allure-results", "Generate a report from the ./allure-results directory"]],
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

  reportName = Option.String("--report-name,--name", {
    description: "The report name (default: Allure Report)",
  });

  dump = Option.Array("--dump", {
    description:
      "Path or pattern that matches one or more archives created by `allure run --dump ...`. " +
      "Allure loads the matched archives before generating the report. " +
      "This option can be specified multiple times.",
  });

  historyPath = Option.String("--history-path", {
    description: "History file path",
  });

  historyLimit = Option.String("--history-limit", {
    description: "Limits the number of history entries to keep (default: unlimited)",
  });

  historyBaseUrl = Option.String("--history-base-url", {
    description: "The public base URL of the generated report directory",
    required: true,
  });

  gitlabToken = Option.String("--gitlab-token", {
    description: "GitLab api token with api write access",
  });

  async execute() {
    const cwd = processCwd();
    const output = this.output ?? "allure-report";
    const config = await readConfig(cwd, this.config, {
      output,
      name: this.reportName,
      historyBaseUrl: this.historyBaseUrl,
      historyPath: this.historyPath === undefined ? "history.jsonl" : this.historyPath,
      historyLimit: this.historyLimit === undefined ? 100 : parseInt(this.historyLimit, 10),
    });

    await generate({
      dump: this.dump,
      resultsDir: this.resultsDir,
      cwd,
      config,
    });
  }
}

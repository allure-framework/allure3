import { existsSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { cwd as processCwd } from "node:process";

import { restoreGitlabHistory, upsertGitlabJobNote, detect, GitlabCiDescriptor } from "@allurereport/ci";
import { readConfig } from "@allurereport/core";
import { CiDescriptor, CiType } from "@allurereport/core-api";
import { Command, Option } from "clipanion";

import { generate } from "../commons/generate.js";

const DEFAULT_HISTORY_LIMIT = 100;
const isDecimalString = (value: string): boolean => /^[0-9]+$/.test(value);

const parseHistoryLimit = (value: unknown): number | undefined => {
  if (typeof value === "string") {
    if (!isDecimalString(value)) {
      return DEFAULT_HISTORY_LIMIT;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_HISTORY_LIMIT;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) && Number.isInteger(value) && value >= 0 ? value : DEFAULT_HISTORY_LIMIT;
  }

  return DEFAULT_HISTORY_LIMIT;
};

const reportBaseUrl = (historyBaseUrl: string | undefined, output: string): string => {
  const gitlab = detect();
  const isGitlabCiDescriptor = (ci: CiDescriptor): ci is GitlabCiDescriptor => ci.type === CiType.Gitlab;

  if (!isGitlabCiDescriptor(gitlab)) {
    throw new Error("GitLab CI environment was not detected");
  }

  if (isAbsolute(output)) {
    const projectDirectory = resolve(gitlab.projectDirectory);
    const absoluteOutput = resolve(output);

    if (absoluteOutput !== projectDirectory && !absoluteOutput.startsWith(join(projectDirectory, sep))) {
      throw new Error("Absolute output path must be within CI_PROJECT_DIR");
    }

    output = relative(projectDirectory, absoluteOutput).split(sep).join("/");
  }

  return historyBaseUrl || `${gitlab.jobArtifactsUrlBase}/${output}`;
};

export class GitlabGenerateCommand extends Command {
  static paths = [["gitlab"]];

  static usage = Command.Usage({
    category: "Integrations",
    description: "Generate test report and post report summary in merge request comments",
    details:
      "This command generates a report from the provided Allure Results directories. When api access token is configured, " +
      "integration will post summary as comment for merge request pipelines and attempt to lookup history file from previously executed job ." +
      "This integration is designed to be executed from within GitLab CI job.",
    examples: [["gitlab ./allure-results", "Generate a report from the ./allure-results directory"]],
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
    description: "Limits the number of history entries to keep (default: 100)",
  });

  historyBaseUrl = Option.String("--history-base-url", {
    description: "The public base URL of the generated report directory",
  });

  gitlabToken = Option.String("--gitlab-token", {
    description: "GitLab api token with api write permissions",
  });

  async execute() {
    const cwd = processCwd();
    const token = this.gitlabToken?.trim() || process.env.GITLAB_TOKEN?.trim() || undefined;
    const output = this.output ?? "allure-report";
    const configPath = this.config && existsSync(this.config) ? this.config : undefined;
    const historyPath = this.historyPath === undefined ? "history.jsonl" : this.historyPath;
    const config = await readConfig(cwd, configPath, {
      output,
      name: this.reportName,
      historyPath: historyPath,
      historyBaseUrl: reportBaseUrl(this.historyBaseUrl, output),
      historyLimit: parseHistoryLimit(this.historyLimit),
    });
    const runGitlabOperation = async (errPrefix: string, operation: () => Promise<void>) => {
      try {
        await operation();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`${errPrefix}: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    // eslint-disable-next-line no-console
    console.log("Generating allure report");
    if (!config.allureService?.accessToken) {
      // eslint-disable-next-line no-console
      console.log("  fetching previous run history");
      await runGitlabOperation("  history fetch failed", () =>
        restoreGitlabHistory({
          token,
          historyPath,
        }),
      );
    }

    const result = await generate({
      cwd,
      config,
      dump: this.dump,
      resultsDir: this.resultsDir,
      collectSummary: true,
    });

    if (!result) {
      return;
    }

    const reportUrl = `${config.historyBaseUrl}/index.html`;
    // eslint-disable-next-line no-console
    console.log(`GitLab report URL: ${reportUrl}`);

    if (result.summary && existsSync(join(config.output, "index.html"))) {
      // eslint-disable-next-line no-console
      console.log("Posting report summary comment");
      if (!token) {
        // eslint-disable-next-line no-console
        console.log("  no API token provided, skipping");
        return;
      }

      const { summary } = result;
      await runGitlabOperation("  failed to add summary comment", () =>
        upsertGitlabJobNote({
          token,
          summary,
          reportUrl,
        }),
      );
    }
  }
}

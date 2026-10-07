import { realpath, rm } from "node:fs/promises";
import process, { exit } from "node:process";

import { Logger } from "@allurereport/cli-commons";
import { AllureReport, isFileNotFoundError, readConfig } from "@allurereport/core";
import { formatDuration } from "@allurereport/core-api";
import Awesome from "@allurereport/plugin-awesome";
import { serve } from "@allurereport/static-server";
import { Command, Option, UsageError } from "clipanion";

import {
  environmentNameOption,
  environmentOption,
  normalizeCommandEnvironmentOptions,
  resolveCommandEnvironment,
} from "../utils/environment.js";
import { createChildAllureCliEnvironment, getActiveAllureCliCommand } from "../utils/execution-context.js";
import { parseRunCommand, resolveResultsPatterns } from "../utils/resultsPatterns.js";
import { serverOptionsFromConfig } from "../utils/serverOptions.js";
import { executeAllureRun, executeNestedAllureCommand } from "./commons/run.js";

const missingRunCommandUsageError = () =>
  new UsageError("expecting command to be specified after --, e.g. allure run -- npm run test");

const runLogger = new Logger("AllureRun");

export class RunCommand extends Command {
  static paths = [["run"]];

  static usage = Command.Usage({
    description: "Run specified command",
    details:
      "This command runs the specified command and collects Allure results. " +
      "Override results discovery with repeated `--results-dir` (CLI overrides `config.resultsDir`). " +
      "When neither is set, directories named `allure-results` are discovered dynamically. " +
      "Quote globs in the shell so they are not expanded early.",
    examples: [
      ["run -- npm run test", "Run npm run test and collect Allure results"],
      ["run --rerun 3 -- npm run test", "Run npm run test and rerun failed tests up to 3 times"],
      [
        "run --dump=my-dump -- npm run test",
        "Run npm run test and pack inner report state into my-dump.zip archive to restore the state in the next run",
      ],
      [
        "run --results-dir './artifacts/**/allure-results' -- npm test",
        "Override results discovery with a quoted glob",
      ],
    ],
  });

  config = Option.String("--config,-c", {
    description: "The path to Allure config file",
  });

  cwd = Option.String("--cwd", {
    description: "The working directory for the command to run (default: current working directory)",
  });

  output = Option.String("--output,-o", {
    description: "The output file name, allure.csv by default. Accepts absolute paths (default: ./allure-report)",
  });

  open = Option.Boolean("--open", {
    description: "Open the report in the default browser after generation (default: false)",
  });

  port = Option.String("--port", {
    description: "The port to serve the reports on. If not set, the server starts on a random port",
  });

  host = Option.String("--host", {
    description:
      "The host (network interface) to serve the reports on, e.g. 127.0.0.1 or 0.0.0.0 (default: all interfaces)",
  });

  reportName = Option.String("--report-name,--name", {
    description: "The report name (default: Allure Report)",
  });

  rerun = Option.String("--rerun", {
    description: "The maximum number of reruns for failed tests and Quality Gate fast-fails (default: 0)",
  });

  silent = Option.Boolean("--silent", {
    description: "Don't pipe the process output logs to console (default: 0)",
  });

  ignoreLogs = Option.Boolean("--ignore-logs", {
    description: "Prevent logs attaching to the report (default: false)",
  });

  dump = Option.String("--dump", {
    description:
      "Runs tests in dump mode to collect results to a dump archive with the provided name (default: empty string)",
  });

  environment = environmentOption();

  environmentName = environmentNameOption();

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
    description: "Path to known issues file",
  });

  resultsDir = Option.Array("--results-dir", {
    description:
      "Glob pattern or path for Allure results directories (repeatable). Overrides config.resultsDir. Quote globs in the shell",
  });

  /**
   * Nested test command after `--`. Nested `--` inside the command argv are preserved when present.
   */
  commandToRun = Option.Rest();

  get logs() {
    if (this.silent) {
      return this.ignoreLogs ? "ignore" : "pipe";
    }

    return this.ignoreLogs ? "inherit" : "pipe";
  }

  async execute() {
    const { command, commandArgs } = parseRunCommand(this.commandToRun as string[]);

    if (!command) {
      throw missingRunCommandUsageError();
    }

    const before = new Date().getTime();

    const cwd = await realpath(this.cwd ?? process.cwd());
    const hideLabels = this.hideLabels?.length ? this.hideLabels : undefined;

    if (getActiveAllureCliCommand()) {
      runLogger.info(`Running nested command: ${[command, ...commandArgs].join(" ")}`);

      const exitCode = await executeNestedAllureCommand({
        command,
        commandArgs,
        cwd,
        silent: this.silent,
      });

      exit(exitCode ?? -1);
      return;
    }

    const environmentOptions = {
      environment: this.environment,
      environmentName: this.environmentName,
    };

    normalizeCommandEnvironmentOptions(environmentOptions);

    const maxRerun = this.rerun ? parseInt(this.rerun, 10) : 0;
    const config = await readConfig(cwd, this.config, {
      output: this.output,
      name: this.reportName,
      open: this.open,
      port: this.port,
      host: this.host,
      hideLabels,
      historyLimit: this.historyLimit !== undefined ? parseInt(this.historyLimit, 10) : undefined,
      ...(this.historyBaseUrl !== undefined ? { historyBaseUrl: this.historyBaseUrl } : {}),
      resolutions: { knownIssuesPath: this.knownIssues },
    });
    const resultsPatterns = resolveResultsPatterns(this.resultsDir ?? [], config.resultsDir);

    const resolvedEnvironment = resolveCommandEnvironment(config, environmentOptions);
    const withQualityGate = !!config.qualityGate;

    try {
      await rm(config.output, { recursive: true });
    } catch (e) {
      if (!isFileNotFoundError(e)) {
        runLogger.error(`Could not clean output directory: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    const allureReport = new AllureReport({
      ...config,
      environment: resolvedEnvironment?.id,
      qualityGate: withQualityGate ? config.qualityGate : undefined,
      dump: this.dump ?? config.dump,
      realTime: false,
      plugins: [
        ...(config.plugins?.length
          ? config.plugins
          : [
              {
                id: "awesome",
                enabled: true,
                options: {},
                plugin: new Awesome({
                  reportName: config.name,
                }),
              },
            ]),
      ],
    });
    const { globalExitCode } = await executeAllureRun({
      allureReport,
      cwd,
      command,
      commandArgs,
      environmentVariables: createChildAllureCliEnvironment("run"),
      environment: resolvedEnvironment?.id,
      withQualityGate,
      logs: this.logs,
      silent: this.silent,
      ignoreLogs: this.ignoreLogs,
      maxRerun,
      resultsPatterns,
    });
    const finalExitCode = globalExitCode.actual ?? globalExitCode.original;

    runLogger.info(`Completed with exit code ${finalExitCode} after ${formatDuration(Date.now() - before)}`);

    if (config.open) {
      await serve({
        ...serverOptionsFromConfig(config),
        servePath: config.output,
        open: true,
      });
    } else {
      exit(finalExitCode);
    }
  }
}

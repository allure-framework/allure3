import * as console from "node:console";
import { realpath, rm } from "node:fs/promises";
import process, { env, exit } from "node:process";

import { detect, isLocalCiDescriptor } from "@allurereport/ci";
import { AllureReport, isFileNotFoundError, readConfig } from "@allurereport/core";
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
import { executeAllureRun, executeAllureWatchRun, executeNestedAllureCommand } from "./commons/run.js";

export class RunCommand extends Command {
  static paths = [["run"]];

  static usage = Command.Usage({
    description: "Run specified command",
    details: "This command runs the specified command and collects Allure results.",
    examples: [
      ["run -- npm run test", "Run npm run test and collect Allure results"],
      ["run --rerun 3 -- npm run test", "Run npm run test and rerun failed tests up to 3 times"],
      [
        "run --dump=my-dump -- npm run test",
        "Run npm run test and pack inner report state into my-dump.zip archive to restore the state in the next run",
      ],
    ],
  });

  config = Option.String("--config,-c", {
    description: "The path Allure config file",
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

  reportName = Option.String("--report-name,--name", {
    description: "The report name (default: Allure Report)",
  });

  rerun = Option.String("--rerun", {
    description:
      "The number of reruns for failed tests. Quality gate validation is skipped when rerun is greater than 0 (default: 0)",
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

  hideLabels = Option.Array("--hide-labels", {
    description: "Hide labels by exact name in generated reports. Repeat the option for multiple labels",
  });

  watch = Option.Boolean("--watch", {
    description:
      "Watch source files and rerun only the changed spec file when it matches --test-match, instead of the whole suite (experimental). Defaults to on outside CI and off in CI; pass --once to force a single run locally",
  });

  once = Option.Boolean("--once", {
    description: "Force a single run and exit, even outside CI where --watch is on by default",
  });

  testMatch = Option.String("--test-match", {
    description:
      "Regular expression used in --watch mode to detect spec files (default: /\\.(spec|test)\\.[cm]?[jt]sx?$/)",
  });

  commandToRun = Option.Rest();

  get logs() {
    if (this.silent) {
      return this.ignoreLogs ? "ignore" : "pipe";
    }

    return this.ignoreLogs ? "inherit" : "pipe";
  }

  async execute() {
    const args = this.commandToRun.filter((arg) => arg !== "--") as string[] | undefined;

    if (!args || !args.length) {
      throw new UsageError("expecting command to be specified after --, e.g. allure run -- npm run test");
    }

    const before = new Date().getTime();

    process.on("exit", (exitCode) => {
      const after = new Date().getTime();

      console.log(`exit code ${exitCode} (${after - before}ms)`);
    });

    const command = args[0];
    const commandArgs = args.slice(1);
    const cwd = await realpath(this.cwd ?? process.cwd());
    const hideLabels = this.hideLabels?.length ? this.hideLabels : undefined;

    console.log(`${command} ${commandArgs.join(" ")}`);

    if (getActiveAllureCliCommand()) {
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
      hideLabels,
      historyLimit: this.historyLimit ? parseInt(this.historyLimit, 10) : undefined,
    });
    const resolvedEnvironment = resolveCommandEnvironment(config, environmentOptions);
    const withRerun = maxRerun > 0;

    if (this.watch && this.once) {
      throw new UsageError("--watch and --once cannot be used together");
    }

    const ci = detect();
    const isCI = !isLocalCiDescriptor(ci) || env.CI === "true" || env.CI === "1";
    const shouldWatch = this.once ? false : (this.watch ?? !isCI);
    const withQualityGate = !!config.qualityGate && !withRerun && !shouldWatch;

    if (config.qualityGate && withRerun) {
      console.warn("Quality gate doesn't work with rerun; skipping quality gate validation.");
    }

    if (config.qualityGate && shouldWatch) {
      console.warn("Quality gate doesn't work with watch; skipping quality gate validation.");
    }

    if (shouldWatch && withRerun) {
      console.warn("--rerun is ignored in --watch mode.");
    }

    try {
      await rm(config.output, { recursive: true });
    } catch (e) {
      if (!isFileNotFoundError(e)) {
        console.error("could not clean output directory", e);
      }
    }
    const allureReport = new AllureReport({
      ...config,
      environment: resolvedEnvironment?.id,
      qualityGate: withQualityGate ? config.qualityGate : undefined,
      dump: this.dump,
      realTime: shouldWatch,
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
    const knownIssues = await allureReport.store.allKnownIssues();

    if (shouldWatch) {
      await executeAllureWatchRun({
        allureReport,
        knownIssues,
        cwd,
        command,
        commandArgs,
        outputDir: config.output,
        environmentVariables: createChildAllureCliEnvironment("run"),
        environment: resolvedEnvironment?.id,
        logs: this.logs,
        silent: this.silent,
        testMatch: this.testMatch ? new RegExp(this.testMatch) : undefined,
      });

      exit(0);
      return;
    }

    const { globalExitCode } = await executeAllureRun({
      allureReport,
      knownIssues,
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
    });

    if (config.open) {
      await serve({
        port: config.port ? parseInt(config.port, 10) : undefined,
        servePath: config.output,
        open: true,
      });
    } else {
      exit(globalExitCode.actual ?? globalExitCode.original);
    }
  }
}

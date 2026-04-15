import * as console from "node:console";
import { realpath, rm } from "node:fs/promises";
import { resolve } from "node:path";
import process, { exit } from "node:process";

import { AllureReport, isFileNotFoundError, readConfig } from "@allurereport/core";
import Awesome from "@allurereport/plugin-awesome";
import { serve } from "@allurereport/static-server";
import { Command, Option, UsageError } from "clipanion";
import { red } from "yoctocolors";

import { executeAllureRun, executeNestedAllureCommand } from "./commons/run.js";
import { executeAgentMode } from "./agent.js";
import {
  environmentNameOption,
  environmentOption,
  normalizeCommandEnvironmentOptions,
  resolveCommandEnvironment,
} from "../utils/environment.js";
import { createChildAllureCliEnvironment, getActiveAllureCliCommand } from "../utils/execution-context.js";

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
    description: "The number of reruns for failed tests (default: 0)",
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

    const legacyAgentOutput = process.env.ALLURE_AGENT_OUTPUT;

    if (legacyAgentOutput) {
      await executeAgentMode({
        configPath: this.config,
        cwd: this.cwd,
        output: resolve(process.cwd(), legacyAgentOutput),
        expectations: process.env.ALLURE_AGENT_EXPECTATIONS
          ? resolve(process.cwd(), process.env.ALLURE_AGENT_EXPECTATIONS)
          : undefined,
        environment: this.environment,
        environmentName: this.environmentName,
        silent: this.silent,
        args,
      });
      return;
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
    const withQualityGate = !!config.qualityGate;
    const withRerun = !!this.rerun;

    if (withQualityGate && withRerun) {
      console.error(red("At this moment, quality gate and rerun can't be used at the same time!"));
      console.error(red("Consider using --rerun=0 or disable quality gate in the config to run tests"));
      exit(-1);
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
      dump: this.dump,
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
    const knownIssues = await allureReport.store.allKnownIssues();
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

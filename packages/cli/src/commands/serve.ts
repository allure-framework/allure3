import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { cwd as processCwd } from "node:process";

import { readConfig } from "@allurereport/core";
import { serve } from "@allurereport/static-server";
import { Command, Option } from "clipanion";
import { red } from "yoctocolors";

import { findFilesByGlobs } from "./../utils/fileSystem.js";
import { resolveResultsPatterns } from "./../utils/resultsPatterns.js";
import { serverOptionsFromConfig } from "./../utils/serverOptions.js";
import { notifySignals, waitForAbort } from "./../utils/signals.js";
import { generate } from "./commons/generate.js";

export abstract class BaseServeCommand extends Command {
  static paths = [["serve"]];

  static usage = Command.Usage({
    description: "Serves an existing report or generates and serves a report from test results.",
    details:
      "This command starts a report server without opening a browser. If test results are provided, it generates the" +
      " report in a temporary directory before serving it. With no arguments, it serves the configured output " +
      "directory or, if no report exists there, generates a report from the configured test results. Use --open " +
      "to also open the report in the default browser.",
    examples: [
      ["serve ./allure-results", "Generate and serve the report from the given test results directory"],
      ["serve --port 8080 ./allure-report", "Serve the report on port 8080"],
      ["serve --open ./allure-report", "Serve the report and open it in the default browser"],
      ["serve --host 127.0.0.1 ./allure-report", "Serve the report on the loopback interface only."],
      [
        "serve ./packages/*/allure-results",
        "Generate and serve the report from all test results directories matching the pattern",
      ],
      [
        "serve ./packages/foo/allure-results ./packages/bar/allure-results",
        "Generate and serve the report from two test results directories",
      ],
    ],
  });

  resultsDir = Option.Rest({
    name:
      "A report path to open, or results patterns. Overrides config.resultsDir. " +
      "Empty Rest serves the configured output.",
  });

  config = Option.String("--config,-c", {
    description: "Path to Allure configuration file",
  });

  port = Option.String("--port", {
    description:
      "Port for the report server. Overrides the configured port; otherwise, a random available port is used",
  });

  host = Option.String("--host", {
    description:
      "Host address to bind the report server to, e.g. 127.0.0.1 or 0.0.0.0. " +
      "Overrides the configured host (default: all interfaces)",
  });

  cwd = Option.String("--cwd", {
    description: "Working directory for the command (default: current working directory)",
  });

  hideLabels = Option.Array("--hide-labels", {
    description: "Hide labels by exact name in generated reports. Repeat the option for multiple labels",
  });

  protected abstract get shouldOpen(): boolean;

  async execute() {
    const cwd = this.cwd ?? processCwd();
    const hideLabels = this.hideLabels?.length ? this.hideLabels : undefined;

    const config = await readConfig(cwd, this.config, {
      port: this.port,
      host: this.host,
    });
    const servePath = this.resolveReportPath(cwd, this.resultsDir, config.output);
    const resolvedPatterns = resolveResultsPatterns(this.resultsDir, config.resultsDir);

    const notifier = notifySignals(["SIGINT", "SIGTERM"]);
    const signalExitCode = () => {
      const info = notifier.info();
      return info?.signal === "SIGINT" ? 0 : (info?.code ?? 0);
    };

    let server: Awaited<ReturnType<typeof serve>> | undefined;
    let tmpDir: string | undefined;

    try {
      if (await this.reportExists(servePath)) {
        if (notifier.signal.aborted) {
          return signalExitCode();
        }

        server = await serve({
          ...serverOptionsFromConfig(config),
          servePath,
          open: this.shouldOpen,
        });
      } else if (resolvedPatterns.length) {
        tmpDir = await mkdtemp(join(tmpdir(), "allure-report-"));
        const config = await readConfig(cwd, this.config, {
          port: this.port,
          host: this.host,
          output: tmpDir,
          hideLabels,
        });

        if (notifier.signal.aborted) {
          return signalExitCode();
        }

        await generate({
          resultsDir: this.resultsDir,
          cwd,
          config,
        });

        if (notifier.signal.aborted) {
          return signalExitCode();
        }
        server = await serve({
          ...serverOptionsFromConfig(config),
          servePath: config.output,
          open: this.shouldOpen,
        });
      } else {
        notifier.dispose();
        console.error(red(`A report doesn't exist in ${servePath} and no input was provided to generate.`));
        return 1;
      }

      await waitForAbort(notifier.signal);
      console.info(`Allure is stopping.`);
    } finally {
      try {
        await server?.stop();
      } catch {}

      if (tmpDir) {
        try {
          await rm(tmpDir, { recursive: true, force: true });
        } catch {}
      }

      notifier.dispose();
    }

    return signalExitCode();
  }

  private resolveReportPath(cwd: string, inputs: readonly string[], fallback: string = "allure-report") {
    if (inputs.length <= 1) {
      const [maybeRelativeReportPath = fallback] = inputs;
      return resolve(cwd, maybeRelativeReportPath);
    }
  }

  private async reportExists(reportPath: string | undefined) {
    if (reportPath && existsSync(reportPath)) {
      const summaryFiles = await findFilesByGlobs(reportPath, [join("**", "summary.json")]);
      return summaryFiles.length > 0;
    }
    return false;
  }
}

export class ServeCommand extends BaseServeCommand {
  open = Option.Boolean("--open", {
    description: "Open the report in the default browser (default: false)",
  });

  protected override get shouldOpen() {
    return Boolean(this.open);
  }
}

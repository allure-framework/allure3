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

export class OpenCommand extends Command {
  static paths = [["open"], ["serve"]];

  static usage = Command.Usage({
    description: "Serves specified directory",
    details: "This command generates report with the given test results and opens it in the default browser.",
    examples: [
      ["open ./allure-results", "Generate and serve the report based on given test results directory"],
      ["open --port 8080 ./allure-report", "Serve the report on port 8080"],
      [
        "open --host 0.0.0.0 ./allure-report",
        "Serve the report on all network interfaces, so it is reachable remotely",
      ],
      [
        "open ./packages/*/allure-results",
        "Generate and serve the report from all Allure result directories matching the pattern",
      ],
      [
        "open ./packages/foo/allure-results /packages/bar/allure-results",
        "Generate and serve the report from two Allure result directories",
      ],
    ],
  });

  resultsDir = Option.Rest({
    name: "A report path to open, or results patterns. Overrides config.resultsDir. Empty Rest serves the configured output.",
  });

  config = Option.String("--config,-c", {
    description: "The path to Allure config file",
  });

  port = Option.String("--port", {
    description: "The port to serve the reports on. If not set, the server starts on a random port",
  });

  host = Option.String("--host", {
    description:
      "The host (network interface) to serve the reports on, e.g. 127.0.0.1 or 0.0.0.0 (default: all interfaces)",
  });

  no_browser = Option.Boolean("--no-browser", {
    description: "Do not open the report in the default browser after serving",
  });

  cwd = Option.String("--cwd", {
    description: "The working directory for the command to run (default: current working directory)",
  });

  hideLabels = Option.Array("--hide-labels", {
    description: "Hide labels by exact name in generated reports. Repeat the option for multiple labels",
  });

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
          open: !this.no_browser,
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
          open: !this.no_browser,
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

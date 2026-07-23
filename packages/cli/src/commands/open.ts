import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { cwd as processCwd, exit } from "node:process";

import { readConfig } from "@allurereport/core";
import { serve } from "@allurereport/static-server";
import { Command, Option } from "clipanion";
import { red } from "yoctocolors";

import { findFilesByGlobs } from "./../utils/fileSystem.js";
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
    name: "A report to open or a pattern to match test results directories in the current working directory (default: configured output)",
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

  hideLabels = Option.Array("--hide-labels", {
    description: "Hide labels by exact name in generated reports. Repeat the option for multiple labels",
  });

  async execute() {
    const cwd = this.cwd ?? processCwd();
    const hideLabels = this.hideLabels?.length ? this.hideLabels : undefined;

    const config = await readConfig(cwd, this.config, {
      port: this.port,
    });
    const servePath = this.resolveReportPath(cwd, this.resultsDir, config.output);

    if (await this.reportExists(servePath)) {
      await serve({
        port: config.port ? parseInt(config.port, 10) : undefined,
        servePath,
        open: true,
      });
    } else if (this.resultsDir.length) {
      const tmpDir = await mkdtemp(join(tmpdir(), "allure-report-"));
      const config = await readConfig(cwd, this.config, {
        port: this.port,
        output: tmpDir,
        hideLabels,
      });

      // At this point, resultsDir contains at least one pattern
      await generate({
        resultsDir: this.resultsDir,
        cwd,
        config,
      });

      // clean up temp report directory on ctrl-c
      const notifier = notifySignals(["SIGINT", "SIGTERM"]);

      void waitForAbort(notifier.signal).then(async () => {
        try {
          await rm(config.output, { recursive: true });
        } catch {}

        process.exit(notifier.info()?.code ?? 0);
      });

      await serve({
        port: config.port ? parseInt(config.port, 10) : undefined,
        servePath: config.output,
        open: true,
      });
    } else {
      console.error(red(`A report doesn't exist in ${servePath} and no input was provided to generate.`));
      exit(1);
      return;
    }
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

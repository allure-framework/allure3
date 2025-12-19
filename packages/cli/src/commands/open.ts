import type { FullConfig } from "@allurereport/core";
import { readConfig } from "@allurereport/core";
import { serve } from "@allurereport/static-server";
import { Command, Option } from "clipanion";
import { glob } from "glob";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { cwd as processCwd } from "node:process";
import { generate } from "./commons/generate.js";

export class OpenCommand extends Command {
  static paths = [["open"], ["serve"]];

  static usage = Command.Usage({
    description: "Serves specified directory",
    details: "This command generates report with the given test results and opens it in the default browser.",
    examples: [
      ["open ./allure-results", "Generate and serve the report based on given test results directory"],
      ["open --port 8080 ./allure-report", "Serve the report on port 8080"],
    ],
  });

  resultsDir = Option.String({
    required: true,
    name: "Pattern to match test results directories in the current working directory (default: ./**/allure-results)",
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

    const isGlobPatternGiven = this.resultsDir.includes("*") || this.resultsDir.includes("?");
    const summaryFilesGlob = isGlobPatternGiven ? this.resultsDir : join(this.resultsDir, "**", "summary.json");
    const summaryFiles = await glob(summaryFilesGlob, {
      mark: true,
      nodir: false,
      absolute: true,
      dot: true,
      windowsPathsNoEscape: true,
      cwd,
    });
    let config: FullConfig;

    // there's no generated report to serve, so we generate it first in a temp directory
    if (!summaryFiles.length) {
      config = await readConfig(cwd, this.config, {
        port: this.port,
        output: join(cwd, ".allure", randomUUID()),
      });

      await mkdir(config.output, { recursive: true });
      await generate({
        resultsDir: this.resultsDir,
        cwd,
        config,
      });
    } else {
      config = await readConfig(cwd, this.config, {
        port: this.port,
        output: this.resultsDir,
      });
    }

    await serve({
      port: config.port ? parseInt(config.port, 10) : undefined,
      servePath: config.output,
      open: true,
    });
  }
}

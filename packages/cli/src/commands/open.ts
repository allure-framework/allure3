import { readConfig } from "@allurereport/core";
import { serve } from "@allurereport/static-server";
import { Command, Option } from "clipanion";
import { glob } from "glob";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
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
    name: "A report to open or a pattern to match test results directories in the current working directory (default: ./allure-results)",
    required: false,
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
    const targetFullPath = join(cwd, this.resultsDir ?? "allure-report");
    const summaryFiles = existsSync(targetFullPath)
      ? await glob(join(targetFullPath, "**", "summary.json"), {
          mark: true,
          nodir: false,
          absolute: true,
          dot: true,
          windowsPathsNoEscape: true,
          cwd,
        })
      : [];

    if (summaryFiles.length > 0) {
      const config = await readConfig(cwd, this.config, {
        port: this.port,
      });

      await serve({
        port: config.port ? parseInt(config.port, 10) : undefined,
        servePath: targetFullPath,
        open: true,
      });
    } else {
      const tmpDir = await mkdtemp(join(tmpdir(), "allure-report-"));
      const config = await readConfig(cwd, this.config, {
        port: this.port,
        output: tmpDir,
      });

      await generate({
        resultsDir: targetFullPath,
        cwd,
        config,
      });

      // clean up temp report directory on ctrl-c
      process.on("SIGINT", async () => {
        try {
          await rm(config.output, { recursive: true });
        } catch {}

        process.exit(0);
      });

      await serve({
        port: config.port ? parseInt(config.port, 10) : undefined,
        servePath: config.output,
        open: true,
      });
    }
  }
}

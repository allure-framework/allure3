import { AllureReport, readConfig } from "@allurereport/core";
import { KnownError } from "@allurereport/service";
import { serve } from "@allurereport/static-server";
import { Command, Option } from "clipanion";
import { glob } from "glob";
import * as console from "node:console";
import { exit, cwd as processCwd } from "node:process";
import { red } from "yoctocolors";
import { logError } from "../utils/logs.js";

export class OpenCommand extends Command {
  static paths = [["open"]];

  static usage = Command.Usage({
    description: "Serves specified directory",
    details: "This command serves the specified report directory and opens it in the default browser.",
    examples: [
      ["open", "Serve the default report directory"],
      ["open custom-report --port 8080 --live", "Serve the custom-report directory on port 8080 with live reload"],
    ],
  });

  resultsDir = Option.String({
    required: false,
    name: "Pattern to match test results directories in the current working directory (default: ./**/allure-results)",
  });

  output = Option.String("--output,-o", {
    description: "The output directory name. Absolute paths are accepted as well (default: allure-report)",
  });

  config = Option.String("--config,-c", {
    description: "The path Allure config file",
  });

  port = Option.String("--port", {
    description: "The port to serve the reports on. If not set, the server starts on a random port",
  });

  live = Option.Boolean("--live", {
    description: "Reload pages on any file change in the served directory",
  });

  cwd = Option.String("--cwd", {
    description: "The working directory for the command to run (default: current working directory)",
  });

  async execute() {
    const cwd = this.cwd ?? processCwd();

    const resultsDir = (this.resultsDir || "./**/allure-results").replace(/[\\/]$/, "");
    const resultsDirectories: string[] = [];
    const config = await readConfig(cwd, this.config, {
      output: this.output,
    });
    const matchedDirs = (
      await glob(resultsDir, {
        mark: true,
        nodir: false,
        absolute: true,
        dot: true,
        windowsPathsNoEscape: true,
        cwd,
      })
    ).filter((p) => /(\/|\\)$/.test(p));

    resultsDirectories.push(...matchedDirs);

    if (resultsDirectories.length === 0) {
      // eslint-disable-next-line no-console
      console.error(red(`No test results directories found matching pattern: ${resultsDir}`));
      exit(1);
      return;
    }

    try {
      const allureReport = new AllureReport(config);

      await allureReport.start();

      for (const dir of resultsDirectories) {
        await allureReport.readDirectory(dir);
      }

      await allureReport.done();

      await serve({
        port: this.port ? parseInt(this.port, 10) : undefined,
        servePath: config.output,
        live: this.live ?? false,
        open: true,
      });
    } catch (error) {
      if (error instanceof KnownError) {
        // eslint-disable-next-line no-console
        console.error(red(error.message));
        exit(1);
        return;
      }

      await logError("Failed to generate report due to unexpected error", error as Error);
      exit(1);
    }
  }
}

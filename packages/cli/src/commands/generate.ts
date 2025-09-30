import { AllureReport, readConfig } from "@allurereport/core";
import { findMatching } from "@allurereport/directory-watcher";
import { KnownError } from "@allurereport/service";
import { Command, Option } from "clipanion";
import { isMatch } from "matcher";
import * as console from "node:console";
import { join } from "node:path";
import { exit, cwd as processCwd } from "node:process";
import { red } from "yoctocolors";
import { logError } from "../utils/logs.js";

export class GenerateCommand extends Command {
  static paths = [["generate"]];

  static usage = Command.Usage({
    description: "Generates the report to specified directory",
    details: "This command generates a report from the provided Allure Results directory.",
    examples: [
      ["generate ./allure-results", "Generate a report from the ./allure-results directory"],
      [
        "generate ./allure-results --output custom-report",
        "Generate a report from the ./allure-results directory to the custom-report directory",
      ],
      [
        "generate --stage=windows --stage=macos.zip ./allure-results",
        "Generate a report using data from windows.zip and macos.zip archives and using results from the ./allure-results directory",
      ],
      [
        "generate --stage=allure-*.zip",
        "Generate a report using data from any stage archive that matches the given pattern only (ignoring results directories)",
      ],
    ],
  });

  resultsDir = Option.String({
    required: false,
    name: "Pattern to match test results directories in the current working directory (default: ./**/allure-results)",
  });

  config = Option.String("--config,-c", {
    description: "The path Allure config file",
  });

  output = Option.String("--output,-o", {
    description: "The output directory name. Absolute paths are accepted as well (default: allure-report)",
  });

  cwd = Option.String("--cwd", {
    description: "The working directory for the command to run (default: current working directory)",
  });

  reportName = Option.String("--report-name,--name", {
    description: "The report name (default: Allure Report)",
  });

  stage = Option.Array("--stage", {
    description: "Stages archives to restore state from (default: empty string)",
  });

  async execute() {
    const cwd = this.cwd ?? processCwd();
    const resultsDir = (this.resultsDir ?? "./**/allure-results").replace(/[\\/]$/, "");
    const config = await readConfig(cwd, this.config, {
      name: this.reportName,
      output: this.output ?? "allure-report",
    });
    const stageDumpFiles: Set<string> = new Set();
    const resultsDirectories = new Set<string>();

    if (this.stage?.length) {
      for (const stage of this.stage) {
        await findMatching(cwd, stageDumpFiles, (dirent) => {
          if (dirent.isFile()) {
            const fullPath = join(dirent?.parentPath ?? dirent?.path, dirent.name);

            return isMatch(fullPath, join(cwd, stage));
          }

          return false;
        });
      }
    }

    // don't read allure results directories without the parameter when stage file has been found
    // or read allure results directory when it is explicitly provided
    if (!!this.resultsDir || stageDumpFiles.size === 0) {
      await findMatching(cwd, resultsDirectories, (dirent) => {
        if (dirent.isDirectory()) {
          const fullPath = join(dirent?.parentPath ?? dirent?.path, dirent.name);

          return isMatch(fullPath, join(cwd, resultsDir));
        }

        return false;
      });
    }

    if (resultsDirectories.size === 0 && stageDumpFiles.size === 0) {
      // eslint-disable-next-line no-console
      console.log(red(`No test results directories found matching pattern: ${resultsDir}`));
      return;
    }

    try {
      const allureReport = new AllureReport(config);

      await allureReport.restoreState(Array.from(stageDumpFiles));
      await allureReport.start();

      for (const dir of resultsDirectories) {
        await allureReport.readDirectory(dir);
      }

      await allureReport.done();
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

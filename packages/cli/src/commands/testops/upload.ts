import { AllureReport, readConfig } from "@allurereport/core";
import { findMatching } from "@allurereport/directory-watcher";
import { KnownError } from "@allurereport/service";
import { Command, Option } from "clipanion";
import * as console from "node:console";
import { realpath } from "node:fs/promises";
import { join } from "node:path";
import { exit, cwd as processCwd } from "node:process";
import pm from "picomatch";
import { red } from "yoctocolors";
import { logError } from "../../utils/index.js";

export class TestOpsUploadCommand extends Command {
  static paths = [["testops", "upload"]];

  static usage = Command.Usage({
    description: "TODO:",
    category: "TODO:",
    details: "TODO:",
    examples: [],
  });

  resultsDir = Option.String({
    required: false,
    name: "Pattern to match test results directories in the current working directory (default: ./**/allure-results)",
  });

  config = Option.String("--config,-c", {
    description: "The path Allure config file",
  });

  cwd = Option.String("--cwd", {
    description: "The working directory for the command to run (default: current working directory)",
  });

  async execute() {
    const cwd = await realpath(this.cwd ?? processCwd());
    const resultsDir = (this.resultsDir ?? "./**/allure-results").replace(/[\\/]$/, "");
    const config = await readConfig(cwd, this.config);

    if (!config?.allureTestOps?.token) {
      console.error(red("Allure TestOps token is not set. Please set it in the config file."));
      exit(1);
      return;
    }

    if (!config?.allureTestOps?.project) {
      console.error(red("Allure TestOps project is not set. Please set it in the config file."));
      exit(1);
      return;
    }

    // TODO: do we need to execute plugins in the command?
    config.plugins = [];

    const matcher = pm(resultsDir, {
      dot: true,
      contains: true,
    });
    const resultsDirectories = new Set<string>();

    await findMatching(cwd, resultsDirectories, (dirent) => {
      if (dirent.isDirectory()) {
        const fullPath = join(dirent?.parentPath ?? dirent?.path, dirent.name);

        return matcher(fullPath);
      }

      return false;
    });

    if (resultsDirectories.size === 0) {
      // eslint-disable-next-line no-console
      console.log(red(`No test results directories found matching pattern: ${resultsDir}`));
      return;
    }

    try {
      const allureReport = new AllureReport(config);

      await allureReport.start();

      for (const dir of resultsDirectories) {
        await allureReport.readDirectory(dir);
      }

      const trs = await allureReport.store.allTestResults();

      console.log("testops upload command: ", trs.length);

      await allureReport.done();
    } catch (error) {
      if (error instanceof KnownError) {
        // eslint-disable-next-line no-console
        console.error(red(error.message));
        exit(1);
        return;
      }

      await logError("TODO:", error as Error);
      exit(1);
    }
  }
}

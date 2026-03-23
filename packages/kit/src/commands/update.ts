import * as console from "node:console";
import { cwd as processCwd } from "node:process";

import { Command, Option } from "clipanion";
import prompts from "prompts";

import { detectInstalledAllurePackages } from "../utils/detect-frameworks.js";
import { detectPackageManager, getInstallCommand } from "../utils/detect-package-manager.js";
import { executeCommand } from "../utils/exec.js";
import { logError, logInfo, logNewLine, logStep, logSuccess, logWarning } from "../utils/ui.js";

export class UpdateCommand extends Command {
  static paths = [["update"]];

  static usage = Command.Usage({
    description: "Update all Allure packages to the latest version",
    examples: [
      ["update", "Check and update all Allure packages"],
      ["update --yes", "Update without confirmation"],
    ],
  });

  yes = Option.Boolean("--yes,-y", false, {
    description: "Update without confirmation",
  });

  cwd = Option.String("--cwd", {
    description: "Working directory (default: current directory)",
  });

  async execute() {
    const workingDir = this.cwd ?? processCwd();

    logStep("Scanning for Allure packages...");

    const installedPackages = await detectInstalledAllurePackages(workingDir);

    if (installedPackages.length === 0) {
      logWarning("No Allure packages found in package.json");
      return;
    }

    console.log();

    for (const { name, version, isDev } of installedPackages) {
      const scope = isDev ? "dev" : "prod";

      logInfo(`${name}@${version} (${scope})`);
    }

    logNewLine();

    if (!this.yes) {
      const { shouldUpdate } = await prompts({
        type: "confirm",
        name: "shouldUpdate",
        message: `Update ${installedPackages.length} package(s) to latest?`,
        initial: true,
      });

      if (!shouldUpdate) {
        logInfo("Update cancelled.");
        return;
      }
    }

    const packageManager = await detectPackageManager(workingDir);
    const devPackages = installedPackages.filter((pkg) => pkg.isDev).map((pkg) => `${pkg.name}@latest`);
    const prodPackages = installedPackages.filter((pkg) => !pkg.isDev).map((pkg) => `${pkg.name}@latest`);

    if (devPackages.length > 0) {
      const installDevCommand = getInstallCommand(packageManager, devPackages, true);

      logInfo(installDevCommand);

      const result = await executeCommand(installDevCommand, workingDir);

      if (result.exitCode !== 0) {
        logError("Failed to update dev packages:");
        console.log(result.stderr);
        return;
      }
    }

    if (prodPackages.length > 0) {
      const installProdCommand = getInstallCommand(packageManager, prodPackages, false);

      logInfo(installProdCommand);

      const result = await executeCommand(installProdCommand, workingDir);

      if (result.exitCode !== 0) {
        logError("Failed to update prod packages:");
        console.log(result.stderr);
        return;
      }
    }

    logSuccess("All Allure packages updated successfully");
    logNewLine();
  }
}

import * as console from "node:console";
import { cwd as processCwd } from "node:process";

import { Command, Option } from "clipanion";
import prompts from "prompts";

import { findExistingConfig, readAllureConfig, updateConfigPlugins } from "./utils/config-io.js";
import { detectPackageManager, getRemoveCommand } from "./utils/detect-package-manager.js";
import { executeCommand } from "./utils/exec.js";
import { findReportPluginById } from "./utils/registry.js";
import { logError, logHint, logInfo, logNewLine, logSuccess, logWarning } from "./utils/ui.js";

export class KitPluginRemoveCommand extends Command {
  static paths = [["kit", "plugin", "remove"]];

  static usage = Command.Usage({
    description: "Remove a report plugin from your Allure config",
    examples: [["kit plugin remove dashboard", "Remove the dashboard plugin"]],
  });

  pluginName = Option.String({ required: true, name: "plugin" });

  cwd = Option.String("--cwd", {
    description: "Working directory (default: current directory)",
  });

  uninstall = Option.Boolean("--uninstall", false, {
    description: "Also uninstall the npm package",
  });

  async execute() {
    const workingDir = this.cwd ?? processCwd();
    const pluginId = this.pluginName;

    const existingConfig = await findExistingConfig(workingDir);

    if (!existingConfig) {
      logError("No allurerc config found. Nothing to remove.");
      return;
    }

    if (existingConfig.format === "mjs") {
      logWarning("Cannot auto-modify ESM config (allurerc.mjs).");
      logHint(`Remove "${pluginId}" from your plugins section manually.`);
      logNewLine();
      return;
    }

    const config = await readAllureConfig(workingDir);

    if (!config?.plugins?.[pluginId]) {
      logWarning(`Plugin "${pluginId}" is not in the config.`);
      return;
    }

    const updated = await updateConfigPlugins(workingDir, pluginId, null);

    if (updated) {
      logSuccess(`Removed "${pluginId}" from config`);
    } else {
      logError("Failed to update config file.");
      return;
    }

    const pluginDescriptor = findReportPluginById(pluginId);

    if (pluginDescriptor && this.uninstall) {
      const packageManager = await detectPackageManager(workingDir);
      const removeCommand = getRemoveCommand(packageManager, [pluginDescriptor.packageName]);

      logInfo(removeCommand);

      const result = await executeCommand(removeCommand, workingDir);

      if (result.exitCode !== 0) {
        logError("Package removal failed:");
        console.log(result.stderr);
        return;
      }

      logSuccess(`Uninstalled ${pluginDescriptor.packageName}`);
    } else if (pluginDescriptor && !this.uninstall) {
      const { shouldUninstall } = await prompts({
        type: "confirm",
        name: "shouldUninstall",
        message: `Also uninstall ${pluginDescriptor.packageName}?`,
        initial: false,
      });

      if (shouldUninstall) {
        const packageManager = await detectPackageManager(workingDir);
        const removeCommand = getRemoveCommand(packageManager, [pluginDescriptor.packageName]);

        logInfo(removeCommand);

        const result = await executeCommand(removeCommand, workingDir);

        if (result.exitCode !== 0) {
          logError("Package removal failed:");
          console.log(result.stderr);
          return;
        }

        logSuccess(`Uninstalled ${pluginDescriptor.packageName}`);
      }
    }
  }
}

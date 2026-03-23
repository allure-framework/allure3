import * as console from "node:console";
import { cwd as processCwd } from "node:process";

import { Command, Option } from "clipanion";
import prompts from "prompts";

import { findExistingConfig, updateConfigPlugins } from "../../utils/config-io.js";
import { detectPackageManager, getInstallCommand } from "../../utils/detect-package-manager.js";
import { executeCommand } from "../../utils/exec.js";
import type { PluginOptionDescriptor } from "../../utils/registry.js";
import { findReportPluginById, REPORT_PLUGIN_REGISTRY } from "../../utils/registry.js";
import { logError, logHint, logInfo, logNewLine, logStep, logSuccess, logWarning } from "../../utils/ui.js";

const promptForOption = async (opt: PluginOptionDescriptor): Promise<unknown> => {
  const envHint = opt.envVar ? ` (env: ${opt.envVar})` : "";

  if (opt.type === "select" && opt.choices) {
    const initial = opt.choices.findIndex((c) => c.value === opt.defaultValue);
    const response = await prompts({
      type: "select",
      name: "value",
      message: `${opt.description}${envHint}`,
      choices: opt.choices,
      initial: initial >= 0 ? initial : 0,
    });

    return response.value;
  }

  if (opt.type === "boolean") {
    const response = await prompts({
      type: "confirm",
      name: "value",
      message: `${opt.description}${envHint}`,
      initial: opt.defaultValue === true,
    });

    return response.value;
  }

  const response = await prompts({
    type: "text",
    name: "value",
    message: `${opt.description}${envHint}`,
    initial: typeof opt.defaultValue === "string" ? opt.defaultValue : undefined,
  });

  return response.value || undefined;
};

export class PluginAddCommand extends Command {
  static paths = [["plugin", "add"]];

  static usage = Command.Usage({
    description: "Add a report plugin to your Allure config",
    examples: [
      ["plugin add dashboard", "Add the dashboard plugin"],
      ["plugin add slack", "Add Slack plugin with interactive options"],
      ["plugin add awesome --skip-options", "Add without configuring options"],
    ],
  });

  pluginName = Option.String({ required: false, name: "plugin" });

  skipOptions = Option.Boolean("--skip-options", false, {
    description: "Skip interactive option prompts, use defaults",
  });

  cwd = Option.String("--cwd", {
    description: "Working directory (default: current directory)",
  });

  async execute() {
    const workingDir = this.cwd ?? processCwd();
    let pluginId = this.pluginName;

    if (!pluginId) {
      const response = await prompts({
        type: "select",
        name: "pluginId",
        message: "Select a plugin to add",
        choices: REPORT_PLUGIN_REGISTRY.map((plugin) => ({
          title: `${plugin.id} — ${plugin.description}`,
          value: plugin.id,
        })),
      });

      pluginId = response.pluginId;

      if (!pluginId) {
        return;
      }
    }

    const pluginDescriptor = findReportPluginById(pluginId);

    if (!pluginDescriptor) {
      logError(`Unknown plugin: ${pluginId}`);
      logInfo("Available plugins:");

      for (const plugin of REPORT_PLUGIN_REGISTRY) {
        logHint(`${plugin.id} — ${plugin.description}`);
      }

      return;
    }

    const options: Record<string, unknown> = {};
    const pluginOptions = pluginDescriptor.options ?? [];

    if (pluginOptions.length > 0 && !this.skipOptions) {
      logStep(`Configure ${pluginId} plugin:`);
      logHint("Press Enter to accept defaults, leave empty to skip optional fields");
      logNewLine();

      for (const opt of pluginOptions) {
        const value = await promptForOption(opt);

        if (value !== undefined && value !== "" && value !== opt.defaultValue) {
          options[opt.name] = value;
        }
      }
    } else if (pluginOptions.length > 0) {
      for (const opt of pluginOptions) {
        if (opt.defaultValue !== undefined) {
          options[opt.name] = opt.defaultValue;
        }
      }
    }

    logStep(`Adding plugin: ${pluginId}`);

    const packageManager = await detectPackageManager(workingDir);
    const installCommand = getInstallCommand(packageManager, [pluginDescriptor.packageName], true);

    logInfo(installCommand);

    const result = await executeCommand(installCommand, workingDir);

    if (result.exitCode !== 0) {
      logError("Package installation failed:");
      console.log(result.stderr);
      return;
    }

    logSuccess(`Installed ${pluginDescriptor.packageName}`);

    const existingConfig = await findExistingConfig(workingDir);

    if (!existingConfig) {
      logWarning("No allurerc config found. Run 'allure-kit init' first to create one.");
      logHint("Then add the plugin manually:");
      logHint(`  ${pluginId}: ${JSON.stringify({ options }, null, 2)}`);
      return;
    }

    if (existingConfig.format === "mjs") {
      logWarning("Cannot auto-modify ESM config (allurerc.mjs).");
      logHint("Add this to your plugins section:");
      logHint(`  ${pluginId}: ${JSON.stringify({ options }, null, 2)}`);
      logNewLine();
      return;
    }

    const updated = await updateConfigPlugins(workingDir, pluginId, { options });

    if (updated) {
      logSuccess(`Added "${pluginId}" to ${existingConfig.path}`);

      if (Object.keys(options).length > 0) {
        logInfo("Configured options:");

        for (const [key, value] of Object.entries(options)) {
          logHint(`${key}: ${JSON.stringify(value)}`);
        }
      }

      const envVarOptions = pluginOptions.filter((o) => o.envVar);

      if (envVarOptions.length > 0) {
        logNewLine();
        logInfo("Sensitive values can also be set via environment variables:");

        for (const opt of envVarOptions) {
          logHint(`${opt.envVar} — ${opt.description}`);
        }
      }
    } else {
      logError("Failed to update config file.");
    }
  }
}

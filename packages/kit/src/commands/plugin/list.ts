import * as console from "node:console";
import { cwd as processCwd } from "node:process";

import { Command, Option } from "clipanion";
import colors from "yoctocolors";

import { readAllureConfig } from "../../utils/config-io.js";
import { REPORT_PLUGIN_REGISTRY } from "../../utils/registry.js";

export class PluginListCommand extends Command {
  static paths = [["plugin", "list"]];

  static usage = Command.Usage({
    description: "List available Allure report plugins",
    examples: [["plugin list", "Show all available plugins and their status"]],
  });

  cwd = Option.String("--cwd", {
    description: "Working directory (default: current directory)",
  });

  async execute() {
    const workingDir = this.cwd ?? processCwd();
    const config = await readAllureConfig(workingDir);
    const configuredPlugins = config?.plugins ?? {};

    console.log("\n  Available Allure Report Plugins:\n");

    const maxIdLength = Math.max(...REPORT_PLUGIN_REGISTRY.map((plugin) => plugin.id.length));

    for (const plugin of REPORT_PLUGIN_REGISTRY) {
      const isConfigured = plugin.id in configuredPlugins;
      const paddedId = plugin.id.padEnd(maxIdLength + 2);
      const statusBadge = isConfigured ? colors.green("[configured]") : colors.dim("            ");
      const defaultBadge = plugin.isDefault ? colors.yellow(" (default)") : "";

      console.log(`    ${paddedId} ${statusBadge}  ${plugin.description}${defaultBadge}`);
    }

    console.log();
  }
}

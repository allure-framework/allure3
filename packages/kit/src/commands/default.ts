import * as console from "node:console";

import { Command } from "clipanion";
import colors from "yoctocolors";

declare const __PKG_VERSION__: string;

const VERSION = typeof __PKG_VERSION__ !== "undefined" ? __PKG_VERSION__ : "dev";

const COMMANDS = [
  {
    name: "init",
    description: "Initialize Allure 3 in your project (auto-detects frameworks, --demo for sample tests)",
  },
  { name: "plugin add <name>", description: "Add a report plugin with interactive options" },
  { name: "plugin remove <name>", description: "Remove a report plugin" },
  { name: "plugin list", description: "List available report plugins" },
  { name: "update", description: "Update all Allure packages to latest" },
  { name: "doctor", description: "Diagnose your Allure configuration" },
];

export class DefaultCommand extends Command {
  static paths = [Command.Default];

  async execute() {
    console.log();
    console.log(`  ${colors.bold("allure-kit")} ${colors.dim(`v${VERSION}`)}`);
    console.log(`  ${colors.dim("Allure 3 toolkit")}`);
    console.log();
    console.log(colors.bold("  Usage:"));
    console.log(`    ${colors.cyan("allure-kit")} ${colors.yellow("<command>")} ${colors.dim("[options]")}`);
    console.log();
    console.log(colors.bold("  Commands:"));

    const maxNameLength = Math.max(...COMMANDS.map((cmd) => cmd.name.length));

    for (const { name, description } of COMMANDS) {
      const paddedName = name.padEnd(maxNameLength + 2);

      console.log(`    ${colors.cyan(paddedName)} ${colors.dim(description)}`);
    }

    console.log();
    console.log(colors.bold("  Options:"));
    console.log(`    ${colors.cyan("--help, -h".padEnd(maxNameLength + 2))} ${colors.dim("Show help for a command")}`);
    console.log(`    ${colors.cyan("--version".padEnd(maxNameLength + 2))} ${colors.dim("Show version number")}`);
    console.log();
    console.log(colors.dim("  Run allure-kit <command> --help for detailed usage of each command."));
    console.log();
  }
}

import { argv } from "node:process";

import { Builtins, Cli } from "clipanion";

import {
  DefaultCommand,
  DoctorCommand,
  InitCommand,
  PluginAddCommand,
  PluginListCommand,
  PluginRemoveCommand,
  UpdateCommand,
} from "./commands/index.js";

declare const __PKG_VERSION__: string;

const VERSION = typeof __PKG_VERSION__ !== "undefined" ? __PKG_VERSION__ : "0.0.0-dev";

const [node, app, ...args] = argv;

const cli = new Cli({
  binaryName: "allure-kit",
  binaryLabel: `${node} ${app}`,
  binaryVersion: VERSION,
});

cli.register(DefaultCommand);
cli.register(InitCommand);
cli.register(UpdateCommand);
cli.register(DoctorCommand);
cli.register(PluginAddCommand);
cli.register(PluginRemoveCommand);
cli.register(PluginListCommand);
cli.register(Builtins.HelpCommand);
cli.register(Builtins.VersionCommand);
cli.register(Builtins.DefinitionsCommand);
cli.runExit(args);

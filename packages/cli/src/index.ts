import { cac } from "cac";
import console from "node:console";
import { readFileSync } from "node:fs";
import { cwd } from "node:process";
import {
  AwesomeCommand,
  ClassicCommand,
  ClassicLegacyCommand,
  CsvCommand,
  DashboardCommand,
  GenerateCommand,
  HistoryCommand,
  KnownIssueCommand,
  LogCommand,
  OpenCommand,
  QualityGateCommand,
  RunCommand,
  SlackCommand,
  TestPlanCommand,
  WatchCommand,
} from "./commands/index.js";

const pkg: { name: string; description: string; version: string } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const cli = cac(pkg.name).usage(pkg.description).help().version(pkg.version);
const commands = [
  ClassicCommand,
  ClassicLegacyCommand,
  AwesomeCommand,
  CsvCommand,
  DashboardCommand,
  GenerateCommand,
  HistoryCommand,
  KnownIssueCommand,
  LogCommand,
  OpenCommand,
  QualityGateCommand,
  RunCommand,
  SlackCommand,
  TestPlanCommand,
  WatchCommand,
];

commands.forEach((command) => {
  command(cli);
});

cli.on("command:*", () => {
  console.error("Invalid command: %s", cli.args.join(" "));
  process.exit(1);
});

console.log(cwd());

cli.parse();

export { defineConfig } from "@allurereport/plugin-api";

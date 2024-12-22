import { cac } from "cac";
import console from "node:console";
import { readFileSync } from "node:fs";
import { cwd } from "node:process";
import {
  AwesomeCommand,
  ClassicCommand,
  CsvCommand,
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

const run = (argv: string[]) => {
  const pkg: { name: string; description: string; version: string } = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  const cli = cac(pkg.name).usage(pkg.description).help().version(pkg.version);
  const commands = [
    ClassicCommand,
    AwesomeCommand,
    CsvCommand,
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

  cli.parse(argv);
};

export { defineConfig } from "@allurereport/plugin-api";

export default run;

import { Builtins, Cli } from "clipanion";
import console from "node:console";
import { readFileSync } from "node:fs";
import { argv, cwd } from "node:process";
import {
  Allure2Command,
  ArchiveCommand,
  AwesomeCommand,
  ClassicCommand,
  CsvCommand,
  DashboardCommand,
  GenerateCommand,
  HistoryCommand,
  KnownIssueCommand,
  LogCommand,
  LoginCommand,
  LogoutCommand,
  OpenCommand,
  ProjectsCreateCommand,
  ProjectsDeleteCommand,
  ProjectsListCommand,
  QualityGateCommand,
  RunCommand,
  SlackCommand,
  TestPlanCommand,
  WatchCommand,
  WhoamiCommand,
} from "./commands/index.js";

const [node, app, ...args] = argv;

const pkg: { name: string; description: string; version: string } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const cli = new Cli({
  binaryName: pkg.name,
  binaryLabel: `${node} ${app}`,
  binaryVersion: pkg.version,
});

cli.register(AwesomeCommand);
cli.register(Allure2Command);
cli.register(ClassicCommand);
cli.register(CsvCommand);
cli.register(DashboardCommand);
cli.register(GenerateCommand);
cli.register(HistoryCommand);
cli.register(KnownIssueCommand);
cli.register(LogCommand);
cli.register(LoginCommand);
cli.register(LogoutCommand);
cli.register(OpenCommand);
cli.register(QualityGateCommand);
cli.register(RunCommand);
cli.register(SlackCommand);
cli.register(TestPlanCommand);
cli.register(WatchCommand);
cli.register(WhoamiCommand);
cli.register(ProjectsCreateCommand);
cli.register(ProjectsDeleteCommand);
cli.register(ProjectsListCommand);
cli.register(ArchiveCommand);
cli.register(Builtins.HelpCommand);
cli.runExit(args);

console.log(cwd());

export { defineConfig } from "@allurereport/plugin-api";

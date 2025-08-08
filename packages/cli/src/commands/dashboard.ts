import { AllureReport, enforcePlugin, readConfig } from "@allurereport/core";
import DashboardPlugin, { type DashboardPluginOptions } from "@allurereport/plugin-dashboard";
import { Command, Option } from "clipanion";
import * as console from "node:console";
import { realpath } from "node:fs/promises";
import process from "node:process";

export class DashboardCommand extends Command {
  static paths = [["dashboard"]];

  static usage = Command.Usage({
    category: "Reports",
    description: "Generates Allure Dashboard report based on provided Allure Results",
    details: "This command generates an Allure Dashboard report from the provided Allure Results directory.",
    examples: [
      ["dashboard ./allure-results", "Generate a report from the ./allure-results directory"],
      [
        "dashboard ./allure-results --output custom-report",
        "Generate a report from the ./allure-results directory to the custom-report directory",
      ],
    ],
  });

  resultsDir = Option.String({ required: true, name: "The directory with Allure results" });

  config = Option.String("--config,-c", {
    description: "The path Allure config file",
  });

  cwd = Option.String("--cwd", {
    description: "The working directory for the command to run (default: current working directory)",
  });

  output = Option.String("--output,-o", {
    description: "The output directory name. Absolute paths are accepted as well",
  });

  reportName = Option.String("--report-name,--name", {
    description: "The report name",
  });

  singleFile = Option.Boolean("--single-file", {
    description: "Generate single file report",
  });

  logo = Option.String("--logo", {
    description: "Path to the report logo which will be displayed in the header",
  });

  theme = Option.String("--theme", {
    description: "Default theme of the report (default: OS theme)",
  });

  reportLanguage = Option.String("--report-language,--lang", {
    description: "Default language of the report (default: OS language)",
  });

  async execute() {
    const cwd = await realpath(this.cwd ?? process.cwd());
    const before = new Date().getTime();
    const defaultDashboardOptions = {
      singleFile: this.singleFile ?? false,
      logo: this.logo,
      theme: this.theme,
      reportLanguage: this.reportLanguage ?? "en",
    } as DashboardPluginOptions;
    const config = enforcePlugin(
      await readConfig(cwd, this.config, {
        output: this.output ?? "allure-report",
        name: this.reportName ?? "Allure Report",
      }),
      {
        id: "dashboard",
        enabled: true,
        options: defaultDashboardOptions,
        plugin: new DashboardPlugin(defaultDashboardOptions),
      },
    );
    const allureReport = new AllureReport(config);

    await allureReport.start();
    await allureReport.readDirectory(this.resultsDir);
    await allureReport.done();

    const after = new Date().getTime();

    console.log(`the report successfully generated (${after - before}ms)`);
  }
}

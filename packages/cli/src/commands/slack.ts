import { AllureReport, readConfig } from "@allurereport/core";
import SlackPlugin, { type SlackPluginOptions } from "@allurereport/plugin-slack";
import { Command, Option } from "clipanion";
import * as console from "node:console";
import { realpath } from "node:fs/promises";
import process from "node:process";

export class SlackCommand extends Command {
  static paths = [["slack"]];

  static usage = Command.Usage({
    category: "Reports",
    description: "Posts test results into Slack Channel",
    details: "This command posts test results from the provided Allure Results directory to a Slack channel.",
    examples: [
      [
        "slack ./allure-results --token xoxb-token --channel C12345",
        "Post test results from the ./allure-results directory to the specified Slack channel",
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

  token = Option.String("--token,-t", {
    description: "Slack Bot User OAuth Token",
    required: true,
  });

  channel = Option.String("--channel", {
    description: "Slack channelId",
    required: true,
  });

  async execute() {
    const cwd = await realpath(this.cwd ?? process.cwd());
    const before = new Date().getTime();
    const defaultSlackOptions = {
      token: this.token,
      channel: this.channel,
    } as SlackPluginOptions;
    const config = await readConfig(cwd, this.config);

    config.plugins = [
      {
        id: "slack",
        enabled: true,
        options: defaultSlackOptions,
        plugin: new SlackPlugin(defaultSlackOptions),
      },
    ];

    const allureReport = new AllureReport(config);

    await allureReport.start();
    await allureReport.readDirectory(this.resultsDir);
    await allureReport.done();

    const after = new Date().getTime();

    console.log(`the report successfully generated (${after - before}ms)`);
  }
}

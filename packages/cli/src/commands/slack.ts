import * as console from "node:console";
import { realpath } from "node:fs/promises";
import process, { exit } from "node:process";

import { AllureReport, readConfig } from "@allurereport/core";
import SlackPlugin, { type SlackPluginOptions } from "@allurereport/plugin-slack";
import { Command, Option } from "clipanion";
import { red } from "yoctocolors";

import { searchAllureResultDirectories } from "../utils/fileSystem.js";

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
      [
        "slack ./packages/*/allure-results --token xoxb-token --channel C12345",
        "Post test results from all Allure result directories matching the pattern",
      ],
      [
        "slack ./packages/foo/allure-results ./packages/bar/allure-results --token xoxb-token --channel C12345",
        "Post test results from two Allure result directories",
      ],
    ],
  });

  resultsDir = Option.Rest({
    name: "Patterns to match test results directories in the current working directory (default: ./**/allure-results)",
  });

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

    const { resultDirectories, patterns } = await searchAllureResultDirectories(cwd, this.resultsDir);
    if (!resultDirectories.length) {
      console.error(red(`No test results directories found matching pattern: ${patterns}`));
      exit(1);
      return;
    }

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

    for (const directory of resultDirectories) {
      await allureReport.readDirectory(directory);
    }

    await allureReport.done();

    const after = new Date().getTime();

    console.log(`the report successfully generated (${after - before}ms)`);
  }
}

import { AllureReport, enforcePlugin, readConfig } from "@allurereport/core";
import SlackPlugin, { type SlackPluginOptions } from "@allurereport/plugin-slack";
import * as console from "node:console";
import { realpath } from "node:fs/promises";
import process from "node:process";
import { createCommand } from "../utils/commands.js";

type CommandOptions = {
  cwd?: string;
  config?: string;
  token: string;
  channel: string;
};

export const SlackCommandAction = async (resultsDir: string, options: CommandOptions) => {
  const cwd = await realpath(options.cwd ?? process.cwd());
  const before = new Date().getTime();
  const { config: configPath, token, channel } = options;
  const defaultSlackOptions = {
    token,
    channel,
  } as SlackPluginOptions;
  const config = enforcePlugin(await readConfig(cwd, configPath), {
    id: "slack",
    enabled: true,
    options: defaultSlackOptions,
    plugin: new SlackPlugin(defaultSlackOptions),
  });
  const allureReport = new AllureReport(config);

  await allureReport.start();
  await allureReport.readDirectory(resultsDir);
  await allureReport.done();

  const after = new Date().getTime();

  console.log(`the report successfully generated (${after - before}ms)`);
};

export const SlackCommand = createCommand({
  name: "slack <resultsDir>",
  description: "Posts test results into Slack Channel",
  options: [
    [
      "--config, -c <file>",
      {
        description: "The path Allure config file",
      },
    ],
    [
      "--cwd <cwd>",
      {
        description: "The working directory for the command to run (Default: current working directory)",
      },
    ],
    [
      "--token, -t <token>",
      {
        description: "Slack Bot User OAuth Token",
      },
    ],
    [
      "--channel, -c <channel>",
      {
        description: "Slack channelId",
      },
    ],
  ],
  action: SlackCommandAction,
});

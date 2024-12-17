import { AllureReport, resolveConfig } from "@allurereport/core";
import * as console from "node:console";
import { createCommand } from "../utils/commands.js";

type CommandOptions = {
  token: string;
  channel: string;
};

export const SlackCommandAction = async (resultsDir: string, options: CommandOptions) => {
  const before = new Date().getTime();
  const config = await resolveConfig({
    plugins: {
      "@allurereport/plugin-slack": {
        options,
      },
    },
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

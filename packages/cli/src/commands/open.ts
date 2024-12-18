import { readConfig } from "@allurereport/core";
import { serve } from "@allurereport/static-server";
import { createCommand } from "../utils/commands.js";

type CommandOptions = {
  config?: string;
  cwd?: string;
  port?: number;
  live: boolean;
};

export const OpenCommandAction = async (reportDir: string | undefined, options: CommandOptions) => {
  const { config: configPath, port, live, cwd } = options;
  const config = await readConfig(cwd, configPath, { output: reportDir });

  await serve({
    port: port,
    servePath: config.output,
    live: Boolean(live),
    open: true,
  });
};

export const OpenCommand = createCommand({
  name: "open [reportDir]",
  description: "Serves specified directory",
  options: [
    [
      "--config, -c <file>",
      {
        description: "The path Allure config file",
      },
    ],
    [
      "--port <string>",
      {
        description: "The port to serve the reports on. If not set, the server starts on a random port",
      },
    ],
    [
      "--live",
      {
        description: "Reload pages on any file change in the served directory",
        default: false,
      },
    ],
    [
      "--cwd <cwd>",
      {
        description: "The working directory for the command to run (default: current working directory)",
      },
    ],
  ],
  action: OpenCommandAction,
});

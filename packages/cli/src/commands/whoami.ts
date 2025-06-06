import { readConfig } from "@allurereport/core";
import { AllureService } from "@allurereport/service";
import { green, red } from "yoctocolors";
import { createCommand } from "../utils/commands.js";

type CommandOptions = {
  config?: string;
  cwd?: string;
};

export const WhoamiCommandAction = async (options?: CommandOptions) => {
  const { config: configPath, cwd } = options ?? {};
  const config = await readConfig(cwd, configPath);

  if (!config?.allureService?.url) {
    // eslint-disable-next-line no-console
    console.error(
      red(
        "No Allure Service URL is provided. Please provide it in the `allureService.url` field in the `allure.config.js` file",
      ),
    );
    process.exit(1);
    return;
  }

  const service = new AllureService(config.allureService);
  const profile = await service.profile();
  const lines: string[] = [`You are logged in as "${profile.email}"`];

  if (config.allureService?.project) {
    lines.push(`Current project is "${config.allureService.project}"`);
  }

  // eslint-disable-next-line no-console
  console.info(green(lines.join("\n")));
};

export const WhoamiCommand = createCommand({
  name: "whoami",
  description: "Prints information about current user",
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
        description: "The working directory for the command to run (default: current working directory)",
      },
    ],
  ],
  action: WhoamiCommandAction,
});

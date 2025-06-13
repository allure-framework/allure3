import { readConfig } from "@allurereport/core";
import { AllureServiceClient, KnownError, UnknownError } from "@allurereport/service";
import { green, red } from "yoctocolors";
import { createCommand } from "../utils/commands.js";
import { logError } from "../utils/logs.js";

type CommandOptions = {
  config?: string;
  cwd?: string;
};

export const LoginCommandAction = async (options?: CommandOptions) => {
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

  const serviceClient = new AllureServiceClient(config.allureService);

  try {
    await serviceClient.login();
    // eslint-disable-next-line no-console
    console.info(green("Logged in"));
  } catch (error) {
    if (error instanceof KnownError) {
      // eslint-disable-next-line no-console
      console.error(red(`Failed to login: ${error.message} (${error.status})`));
      process.exit(1);
      return;
    }

    if (error instanceof UnknownError) {
      const logFilePath = await logError(error?.message ?? "Failed to login due to unexpected error", error.stack);

      // eslint-disable-next-line no-console
      console.error(
        red(
          `Failed to login due to unexpected error (status ${error.status}). Check logs for more details: ${logFilePath}`,
        ),
      );
      process.exit(1);
      return;
    }

    throw error;
  }
};

export const LoginCommand = createCommand({
  name: "login",
  description: "Logs in to the Allure Service",
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
  action: LoginCommandAction,
});

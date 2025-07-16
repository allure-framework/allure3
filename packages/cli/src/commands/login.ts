import { readConfig } from "@allurereport/core";
import { AllureServiceClient, KnownError } from "@allurereport/service";
import { Command, Option } from "clipanion";
import process from "node:process";
import { green, red } from "yoctocolors";
import { logError } from "../utils/logs.js";

export class LoginCommand extends Command {
  static paths = [["login"]];

  static usage = Command.Usage({
    description: "Logs in to the Allure Service",
    details: "This command logs in to the Allure Service using the configuration from the Allure config file.",
    examples: [
      ["login", "Log in to the Allure Service using the default configuration"],
      ["login --config custom-config.js", "Log in to the Allure Service using a custom configuration file"],
    ],
  });

  config = Option.String("--config,-c", {
    description: "The path Allure config file",
  });

  cwd = Option.String("--cwd", {
    description: "The working directory for the command to run (default: current working directory)",
  });

  async execute() {
    const config = await readConfig(this.cwd, this.config);

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
        console.error(red(error.message));
        process.exit(1);
        return;
      }

      await logError("Failed to login due to unexpected error", error as Error);
      process.exit(1);
    }
  }
}

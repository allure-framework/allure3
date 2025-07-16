import { readConfig } from "@allurereport/core";
import { AllureServiceClient, KnownError } from "@allurereport/service";
import { Command, Option } from "clipanion";
import process from "node:process";
import { green, red } from "yoctocolors";
import { logError } from "../utils/logs.js";

export class WhoamiCommand extends Command {
  static paths = [["whoami"]];

  static usage = Command.Usage({
    description: "Prints information about current user",
    details: "This command prints information about the current user logged in to the Allure Service.",
    examples: [
      ["whoami", "Print information about the current user using the default configuration"],
      [
        "whoami --config custom-config.js",
        "Print information about the current user using a custom configuration file",
      ],
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
      const profile = await serviceClient.profile();
      const lines: string[] = [`You are logged in as "${profile.email}"`];

      if (config.allureService?.project) {
        lines.push(`Current project is "${config.allureService.project}"`);
      }

      // eslint-disable-next-line no-console
      console.info(green(lines.join("\n")));
    } catch (error) {
      if (error instanceof KnownError) {
        // eslint-disable-next-line no-console
        console.error(red(error.message));
        process.exit(1);
        return;
      }

      await logError("Failed to get profile due to unexpected error", error as Error);
      process.exit(1);
    }
  }
}

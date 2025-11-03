import { readConfig } from "@allurereport/core";
import { AllureServiceClient, KnownError } from "@allurereport/service";
import { Command, Option } from "clipanion";
import * as console from "node:console";
import { exit } from "node:process";
import { green, red } from "yoctocolors";
import { logError } from "../utils/logs.js";

export class WhoamiCommand extends Command {
  static paths = [["whoami"]];

  static usage = Command.Usage({
    category: "Allure Service",
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
      exit(1);
      return;
    }

    const serviceClient = new AllureServiceClient(config.allureService);
    const outputLines: string[] = [];

    try {
      const profile = await serviceClient.profile();

      outputLines.push(`You are logged in as "${profile.email}"`);
    } catch (error) {
      if (error instanceof KnownError) {
        // eslint-disable-next-line no-console
        console.error(red(error.message));
        exit(1);
        return;
      }

      await logError("Failed to get profile due to unexpected error", error as Error);
      exit(1);
    }

    if (config.allureService.project) {
      try {
        const { project } = await serviceClient.project(config.allureService.project);

        outputLines.push(`Current project is "${project.name}" (id: ${project.id})`);
      } catch (err) {
        outputLines.push(`Configured project can't be resolved (id: ${config.allureService.project})`);
      }
    }

    console.info(green(outputLines.join("\n")));
  }
}

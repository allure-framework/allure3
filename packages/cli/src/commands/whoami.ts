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
    description: "Prints information about current project",
    details:
      "This command prints information about the current project based on the Allure Service provided access token.",
    examples: [["whoami", "Print information about the current project using the default configuration"]],
  });

  config = Option.String("--config,-c", {
    description: "The path Allure config file",
  });

  cwd = Option.String("--cwd", {
    description: "The working directory for the command to run (default: current working directory)",
  });

  async execute() {
    const config = await readConfig(this.cwd, this.config);

    if (!config?.allureService?.accessToken) {
      // eslint-disable-next-line no-console
      console.error(
        red(
          "No Allure Service access token is provided. Please provide it in the `allureService.accessToken` field in the `allure.config.js` file",
        ),
      );
      exit(1);
      return;
    }

    const serviceClient = new AllureServiceClient(config.allureService);
    const outputLines: string[] = [];

    try {
      const { user, project } = await serviceClient.profile();

      // TODO: do we need to show user-related info at all?
      outputLines.push(`You are logged in as "${user.email}"`);
      outputLines.push(`Current project is "${project.name}"`);
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

    console.info(green(outputLines.join("\n")));
  }
}

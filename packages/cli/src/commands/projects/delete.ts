import { readConfig } from "@allurereport/core";
import { AllureServiceClient, KnownError } from "@allurereport/service";
import { Command, Option } from "clipanion";
import * as console from "node:console";
import { exit } from "node:process";
import prompts from "prompts";
import { green, red } from "yoctocolors";
import { logError } from "../../utils/logs.js";

export class ProjectsDeleteCommand extends Command {
  static paths = [["projects", "delete"]];

  static usage = Command.Usage({
    category: "Allure Service Projects",
    description: "Deletes a project",
    details: "This command deletes a project from the Allure Service.",
    examples: [
      ["project-delete my-project", "Delete the project named 'my-project' (with confirmation)"],
      ["project-delete my-project --force", "Delete the project named 'my-project' without confirmation"],
    ],
  });

  projectName = Option.String({ required: true, name: "Project name" });

  force = Option.Boolean("--force", {
    description: "Delete project with no confirmation",
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

    if (!this.force) {
      const res = await prompts({
        type: "confirm",
        name: "value",
        message: `Are you sure you want to delete project "${this.projectName}"?`,
      });

      if (!res.value) {
        exit(0);
        return;
      }
    }

    try {
      await serviceClient.deleteProject({
        name: this.projectName,
      });

      // eslint-disable-next-line no-console
      console.info(green("Project has been deleted"));
    } catch (error) {
      if (error instanceof KnownError) {
        // eslint-disable-next-line no-console
        console.error(red(error.message));
        exit(1);
        return;
      }

      await logError("Failed to delete project due to unexpected error", error as Error);
      exit(1);
    }
  }
}

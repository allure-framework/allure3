import { readConfig } from "@allurereport/core";
import { AllureServiceClient, KnownError } from "@allurereport/service";
import { Command, Option } from "clipanion";
import process from "node:process";
import prompts from "prompts";
import { green, red, yellow } from "yoctocolors";
import { logError } from "../../utils/logs.js";

export class ProjectsListCommand extends Command {
  static paths = [["projects", "list"]];

  static usage = Command.Usage({
    description: "Shows list of all available projects for current user",
    details:
      "This command lists all available projects for the current user and allows selecting one to get configuration information.",
    examples: [["projects", "List all available projects"]],
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
      const projects = await serviceClient.projects();

      if (projects.length === 0) {
        // eslint-disable-next-line no-console
        console.info(yellow("No projects found. Create a new one with `allure project-create` command"));
        return;
      }

      const res = await prompts({
        type: "select",
        name: "project",
        message: "Select a project",
        choices: projects.map((project) => ({
          title: project.name,
          value: project.name,
        })),
      });

      if (!res?.project) {
        // eslint-disable-next-line no-console
        console.error(red("No project selected"));
        process.exit(1);
        return;
      }

      const lines: string[] = [
        "Insert following code into your Allure Config file, to enable Allure Service features for the project:",
        "",
        green("{"),
        green("  allureService: {"),
        green(`    project: "${res.project}"`),
        green("  }"),
        green("}"),
      ];

      // eslint-disable-next-line no-console
      console.info(lines.join("\n"));
    } catch (error) {
      if (error instanceof KnownError) {
        // eslint-disable-next-line no-console
        console.error(red(error.message));
        process.exit(1);
        return;
      }

      await logError("Failed to get projects due to unexpected error", error as Error);
      process.exit(1);
    }
  }
}

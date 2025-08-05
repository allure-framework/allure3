import { getGitRepoName, readConfig } from "@allurereport/core";
import { AllureServiceClient, KnownError } from "@allurereport/service";
import { Command, Option } from "clipanion";
import * as console from "node:console";
import { exit } from "node:process";
import prompts from "prompts";
import { green, red } from "yoctocolors";
import { logError } from "../../utils/logs.js";

export class ProjectsCreateCommand extends Command {
  static paths = [["projects", "create"]];

  static usage = Command.Usage({
    category: "Allure Service Projects",
    description: "Creates a new project",
    details: "This command creates a new project in the Allure Service.",
    examples: [
      ["project create my-project", "Create a new project named 'my-project'"],
      ["project create", "Create a new project with a name from git repo or prompt for a name"],
    ],
  });

  projectName = Option.String({ required: false, name: "Project name" });

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
    let name = this.projectName;

    // try to retrieve project name from git repo
    if (!name) {
      try {
        name = await getGitRepoName();
      } catch (ignored) {}
    }

    // if the project name is not provided and it can't be retrieved from git repo, ask user to enter it
    if (!name) {
      const res = await prompts({
        type: "text",
        name: "name",
        message: "Enter project name",
      });

      name = res?.name;
    }

    if (!name) {
      // eslint-disable-next-line no-console
      console.error(red("No project name provided!"));
      exit(1);
      return;
    }

    try {
      const project = await serviceClient.createProject({
        name,
      });
      const lines: string[] = [
        `The "${green(project.name)}" has been created. Insert following code into your Allure Config file, to enable Allure Service features for the project:`,
        "",
        green("{"),
        green("  allureService: {"),
        green(`    project: "${project.name}"`),
        green("  }"),
        green("}"),
      ];

      // eslint-disable-next-line no-console
      console.info(lines.join("\n"));
    } catch (error) {
      if (error instanceof KnownError) {
        // eslint-disable-next-line no-console
        console.error(red(error.message));
        exit(1);
        return;
      }

      await logError("Failed to create project due to unexpected error", error as Error);
      exit(1);
    }
  }
}

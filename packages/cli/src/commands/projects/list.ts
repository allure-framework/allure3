import { readConfig } from "@allurereport/core";
import { AllureServiceClient, KnownError, UnknownError } from "@allurereport/service";
import prompts from "prompts";
import { green, red, yellow } from "yoctocolors";
import { createCommand } from "../../utils/commands.js";
import { logError } from "../../utils/logs.js";

type CommandOptions = {
  config?: string;
  cwd?: string;
};

export const ProjectsListCommandAction = async (options?: CommandOptions) => {
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
      console.error(red(`Failed to get projects: ${error.message} (${error.status})`));
      process.exit(1);
      return;
    }

    if (error instanceof UnknownError) {
      const logFilePath = await logError(
        error?.message ?? "Failed to get projects due to unexpected error",
        error.stack,
      );

      // eslint-disable-next-line no-console
      console.error(
        red(
          `Failed to get projects due to unexpected error (status ${error.status}). Check logs for more details: ${logFilePath}`,
        ),
      );
      process.exit(1);
      return;
    }

    throw error;
  }
};

export const ProjectsListCommand = createCommand({
  name: "projects",
  description: "Shows list of all available projects for current user",
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
  action: ProjectsListCommandAction,
});

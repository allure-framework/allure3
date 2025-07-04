import { readConfig } from "@allurereport/core";
import { AllureServiceClient, KnownError } from "@allurereport/service";
import prompts from "prompts";
import { green, red } from "yoctocolors";
import { createCommand } from "../../utils/commands.js";
import { logError } from "../../utils/logs.js";

export type CommandOptions = {
  force?: boolean;
  config?: string;
  cwd?: string;
};

export const ProjectsDeleteCommandAction = async (projectName?: string, options?: CommandOptions) => {
  const { force = false } = options ?? {};
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

  if (!projectName) {
    // eslint-disable-next-line no-console
    console.error(red("No project name is provided"));
    process.exit(1);
    return;
  }

  if (!force) {
    const res = await prompts({
      type: "confirm",
      name: "value",
      message: `Are you sure you want to delete project "${projectName}"?`,
    });

    if (!res.value) {
      process.exit(0);
      return;
    }
  }

  try {
    await serviceClient.deleteProject({
      name: projectName,
    });

    // eslint-disable-next-line no-console
    console.info(green("Project has been deleted"));
  } catch (error) {
    if (error instanceof KnownError) {
      // eslint-disable-next-line no-console
      console.error(red(error.message));
      process.exit(1);
      return;
    }

    await logError("Failed to delete project due to unexpected error", error as Error);
    process.exit(1);
  }
};

export const ProjectsDeleteCommand = createCommand({
  name: "project-delete <name>",
  description: "",
  options: [
    [
      "--force",
      {
        description: "Delete project with no confirmation",
        default: false,
      },
    ],
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
  action: ProjectsDeleteCommandAction,
});

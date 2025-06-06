import { readConfig } from "@allurereport/core";
import { AllureService } from "@allurereport/service";
import prompts from "prompts";
import { green, red, yellow } from "yoctocolors";
import { createCommand } from "../../utils/commands.js";

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

  const service = new AllureService(config.allureService);
  const projects = await service.projects();

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

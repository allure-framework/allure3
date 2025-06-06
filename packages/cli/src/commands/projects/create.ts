import { getGitRepoName, readConfig } from "@allurereport/core";
import { AllureService } from "@allurereport/service";
import prompts from "prompts";
import { green, red } from "yoctocolors";
import { createCommand } from "../../utils/commands.js";

type CommandOptions = {
  config?: string;
  cwd?: string;
};

export const ProjectsCreateCommandAction = async (projectName?: string, options?: CommandOptions) => {
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
  let name = projectName;

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
    process.exit(1);
    return;
  }

  const project = await service.createProject({
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
};

export const ProjectsCreateCommand = createCommand({
  name: "project-create [name]",
  description: "",
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
  action: ProjectsCreateCommandAction,
});

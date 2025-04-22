import { getGitRepoName, readConfig } from "@allurereport/core";
import { AllureService } from "@allurereport/service";
import { exit } from "node:process";
import prompts from "prompts";
import { green, red } from "yoctocolors";
import { createCommand } from "../../utils/commands.js";

export const ProjectInitCommandAction = async () => {
  const config = await readConfig();
  let name = "";

  try {
    name = await getGitRepoName();
  } catch (err) {}

  if (!name) {
    const res = await prompts({
      type: "text",
      name: "name",
      message: "Please enter project name",
    });

    name = res.name;
  }

  if (!name) {
    // eslint-disable-next-line no-console
    console.error(red("No project name is provided"));
    exit(1);
  }

  const service = new AllureService(config?.allureService);
  const projects = await service.projects();

  if (projects.find((project) => project.name === name)) {
    // eslint-disable-next-line no-console
    console.error(red(`Project with name "${name}" already exists. Please choose another name`));
    exit(1);
  }

  await service.createProject({ name });

  const lines: string[] = [
    `The project "${green(name)}" has been created`,
    "Insert following code into your Allure Config file, to enable Allure Service features for the project:",
    "",
    green("{"),
    green("  allureService:"),
    green(`    project: "${name}"`),
    green("  }"),
    green("}"),
  ];

  // eslint-disable-next-line no-console
  console.info(lines.join("\n"));
};

export const ProjectInitCommand = createCommand({
  name: "init",
  description: "Initialize the project in the Allure Service",
  options: [],
  action: ProjectInitCommandAction,
});

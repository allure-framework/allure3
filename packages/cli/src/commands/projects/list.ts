import { readConfig } from "@allurereport/core";
import { AllureService } from "@allurereport/service";
import { exit } from "node:process";
import prompts from "prompts";
import { green, red, yellow } from "yoctocolors";
import { createCommand } from "../../utils/commands.js";

export const ProjectsListCommandAction = async () => {
  const config = await readConfig();
  const service = new AllureService(config?.allureService);
  const projects = await service.projects();

  if (projects.length === 0) {
    // eslint-disable-next-line no-console
    console.info(yellow("No projects found. Create a new one with `allure create-project` command"));
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
    exit(1);
  }

  const lines: string[] = [
    "Insert following code into your Allure Config file, to enable Allure Service features for the project:",
    "",
    green("{"),
    green("  allureService:"),
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
  options: [],
  action: ProjectsListCommandAction,
});

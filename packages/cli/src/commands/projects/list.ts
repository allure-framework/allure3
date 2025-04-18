import { readConfig } from "@allurereport/core";
import { AllureHistoryService } from "@allurereport/history";
import { green } from "yoctocolors";
import { createCommand } from "../../utils/commands.js";

export const ProjectsListCommandAction = async () => {
  const config = await readConfig();
  const historyService = new AllureHistoryService(config.historyServiceUrl);
  const projects = await historyService.projects();

  if (projects.length === 0) {
    // eslint-disable-next-line no-console
    console.info("No projects found. Create a new one with `allure project create` command");
    return;
  }

  const lines: string[] = ["You have following projects:"];

  projects.forEach((project) => {
    const name = project.name.length > 20 ? `${project.name.slice(0, 17)}...` : project.name;

    lines.push(`- ${name} ${green(`<${project.id}>`)}`);
  });

  // eslint-disable-next-line no-console
  console.info(lines.join("\n"));
};

export const ProjectsListCommand = createCommand({
  name: "projects",
  description: "Shows list of all available projects for current user",
  options: [],
  action: ProjectsListCommandAction,
});

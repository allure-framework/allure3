import { readConfig } from "@allurereport/core";
import { AllureService } from "@allurereport/service";
import { green } from "yoctocolors";
import { createCommand } from "../../utils/commands.js";

export const ProjectsCreateCommandAction = async (projectName: string) => {
  const config = await readConfig();
  const historyService = new AllureService(config?.allureService?.url);
  const project = await historyService.createProject({
    name: projectName,
  });

  // eslint-disable-next-line no-console
  console.info(`The ${project.name} ${`<${green(project.id)}>`} has been created`);
};

export const ProjectsCreateCommand = createCommand({
  name: "project-create <name>",
  description: "",
  options: [],
  action: ProjectsCreateCommandAction,
});

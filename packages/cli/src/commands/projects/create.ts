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
  const lines: string[] = [
    `The "${green(project.name)}" has been created. Insert following code into your Allure Config file, to enable Allure Service features for the project:`,
    "",
    "{",
    "  allureService:",
    `    project: "${project.name}"`,
    "  }",
    "}",
  ];

  // eslint-disable-next-line no-console
  console.info(lines.join("\n"));
};

export const ProjectsCreateCommand = createCommand({
  name: "project-create <name>",
  description: "",
  options: [],
  action: ProjectsCreateCommandAction,
});

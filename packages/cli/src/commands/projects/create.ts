import { readConfig } from "@allurereport/core";
import { AllureService } from "@allurereport/service";
import { green } from "yoctocolors";
import { createCommand } from "../../utils/commands.js";

export const ProjectsCreateCommandAction = async (projectName: string) => {
  const config = await readConfig();
  const service = new AllureService(config?.allureService);
  const project = await service.createProject({
    name: projectName,
  });
  const lines: string[] = [
    `The "${green(project.name)}" has been created. Insert following code into your Allure Config file, to enable Allure Service features for the project:`,
    "",
    green("{"),
    green("  allureService:"),
    green(`    project: "${project.name}"`),
    green("  }"),
    green("}"),
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

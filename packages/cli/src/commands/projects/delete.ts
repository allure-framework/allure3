import { readConfig } from "@allurereport/core";
import { AllureService } from "@allurereport/service";
import { exit } from "node:process";
import prompts from "prompts";
import { createCommand } from "../../utils/commands.js";

export type ProjectsDeleteCommandOptions = {
  force?: boolean;
};

export const ProjectsDeleteCommandAction = async (
  projectName: string | undefined,
  options?: ProjectsDeleteCommandOptions,
) => {
  const { force = false } = options ?? {};
  const config = await readConfig();
  const allureService = new AllureService(config?.allureService?.url);

  if (!projectName) {
    // eslint-disable-next-line no-console
    console.error("No project name is provided");
    exit(1);
  }

  if (!force) {
    const res = await prompts({
      type: "confirm",
      name: "value",
      message: `Are you sure you want to delete project "${projectName}"?`,
    });

    if (!res.value) {
      exit(0);
    }
  }

  await allureService.deleteProject({
    name: projectName,
  });

  // eslint-disable-next-line no-console
  console.info("Project has been deleted");
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
  ],
  action: ProjectsDeleteCommandAction,
});

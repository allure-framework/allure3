import { readConfig } from "@allurereport/core";
import { AllureService } from "@allurereport/service";
import { createCommand } from "../../utils/commands.js";

export const ProjectsDeleteCommandAction = async (projectId: string | undefined) => {
  const config = await readConfig();
  const historyService = new AllureService(config?.allureService?.url);

  await historyService.deleteProject({
    id: projectId!,
  });

  // eslint-disable-next-line no-console
  console.info("Project has been deleted");
};

export const ProjectsDeleteCommand = createCommand({
  name: "project-delete <id>",
  description: "",
  options: [],
  action: ProjectsDeleteCommandAction,
});

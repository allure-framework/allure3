import { readConfig } from "@allurereport/core";
import { AllureHistoryService } from "@allurereport/history";
import { createCommand } from "../../utils/commands.js";

export const ProjectsDeleteCommandAction = async (projectId: string | undefined) => {
  const config = await readConfig();
  const historyService = new AllureHistoryService(config.historyServiceUrl);

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

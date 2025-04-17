import { readConfig } from "@allurereport/core";
import { AllureHistoryService } from "@allurereport/history";
import { createCommand } from "../utils/commands.js";

export const WhoamiCommandAction = async () => {
  const config = await readConfig();
  const historyService = new AllureHistoryService(config.historyServiceUrl);
  const profile = await historyService.profile();

  // eslint-disable-next-line no-console
  console.info(`You are logged in as ${profile.email}`);
};

export const WhoamiCommand = createCommand({
  name: "whoami",
  description: "Prints information about current user",
  options: [],
  action: WhoamiCommandAction,
});

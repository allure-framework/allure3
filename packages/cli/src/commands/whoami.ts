import { readConfig } from "@allurereport/core";
import { AllureService } from "@allurereport/service";
import { createCommand } from "../utils/commands.js";

export const WhoamiCommandAction = async () => {
  const config = await readConfig();
  const historyService = new AllureService(config?.allureService?.url);
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

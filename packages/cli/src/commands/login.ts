import { readConfig } from "@allurereport/core";
import { AllureHistoryService } from "@allurereport/history";
import { createCommand } from "../utils/commands.js";

export const LoginCommandAction = async () => {
  const config = await readConfig();
  const historyService = new AllureHistoryService(config.historyServiceUrl);

  await historyService.login();
  // eslint-disable-next-line no-console
  console.info("Logged in");
};

export const LoginCommand = createCommand({
  name: "login",
  description: "Logins to the Allure History Service",
  options: [],
  action: LoginCommandAction,
});

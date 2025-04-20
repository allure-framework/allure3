import { readConfig } from "@allurereport/core";
import { AllureService } from "@allurereport/service";
import { createCommand } from "../utils/commands.js";

export const LoginCommandAction = async () => {
  const config = await readConfig();
  const historyService = new AllureService(config?.allureService?.url);

  await historyService.login();
  // eslint-disable-next-line no-console
  console.info("Logged in");
};

export const LoginCommand = createCommand({
  name: "login",
  description: "Logins to the Allure Service",
  options: [],
  action: LoginCommandAction,
});

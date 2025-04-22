import { readConfig } from "@allurereport/core";
import { AllureService } from "@allurereport/service";
import { green } from "yoctocolors";
import { createCommand } from "../utils/commands.js";

export const LoginCommandAction = async () => {
  const config = await readConfig();
  const service = new AllureService(config?.allureService);

  await service.login();
  // eslint-disable-next-line no-console
  console.info(green("Logged in"));
};

export const LoginCommand = createCommand({
  name: "login",
  description: "Logins to the Allure Service",
  options: [],
  action: LoginCommandAction,
});

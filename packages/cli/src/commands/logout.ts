import { readConfig } from "@allurereport/core";
import { AllureService } from "@allurereport/service";
import { green } from "yoctocolors";
import { createCommand } from "../utils/commands.js";

export const LogoutCommandAction = async () => {
  const config = await readConfig();
  const service = new AllureService(config?.allureService);

  await service.logout();
  // eslint-disable-next-line no-console
  console.info(green("Logged out"));
};

export const LogoutCommand = createCommand({
  name: "login",
  description: "Logouts to the Allure Service",
  options: [],
  action: LogoutCommandAction,
});

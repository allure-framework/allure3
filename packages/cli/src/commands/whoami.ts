import { readConfig } from "@allurereport/core";
import { AllureService } from "@allurereport/service";
import { green } from "yoctocolors";
import { createCommand } from "../utils/commands.js";

export const WhoamiCommandAction = async () => {
  const config = await readConfig();
  const service = new AllureService(config?.allureService);
  const profile = await service.profile();
  const lines: string[] = [`You are logged in as "${profile.email}"`];

  if (config.allureService?.project) {
    lines.push(`Current project is "${config.allureService.project}"`);
  }

  // eslint-disable-next-line no-console
  console.info(green(lines.join("\n")));
};

export const WhoamiCommand = createCommand({
  name: "whoami",
  description: "Prints information about current user",
  options: [],
  action: WhoamiCommandAction,
});

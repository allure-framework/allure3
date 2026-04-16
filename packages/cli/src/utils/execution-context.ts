import process from "node:process";

export const ALLURE_CLI_ACTIVE_COMMAND_ENV = "ALLURE_CLI_ACTIVE_COMMAND";

export type AllureCliActiveCommand = "agent" | "run";

export const getActiveAllureCliCommand = (): AllureCliActiveCommand | undefined => {
  const activeCommand = process.env[ALLURE_CLI_ACTIVE_COMMAND_ENV];

  return activeCommand === "agent" || activeCommand === "run" ? activeCommand : undefined;
};

export const createChildAllureCliEnvironment = (command: AllureCliActiveCommand): Record<string, string> => ({
  [ALLURE_CLI_ACTIVE_COMMAND_ENV]: command,
});

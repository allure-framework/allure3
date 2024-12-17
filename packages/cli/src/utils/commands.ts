import type { CAC } from "cac";

export type OptionDescription =
  | [string]
  | [
      string,
      {
        description?: string;
        type?: any[];
        default?: any;
      },
    ];

export type CreateCommandOptions = {
  name: string;
  description?: string;
  options?: OptionDescription[];
  action: (...args: any[]) => Promise<void>;
};

export const createCommand = (payload: CreateCommandOptions) => {
  if (!payload.name) {
throw new Error("Command name is not provided!");
}
  if (!payload.action) {
throw new Error("Command action is not provided!");
}

  return (cli: CAC) => {
    const command = cli.command(payload.name, payload.description);

    payload?.options?.forEach(([name, parameters]) => {
      const { description = "", ...rest } = parameters || {};

      command.option(name, description, rest);
    });

    command.action(payload.action);
  };
};

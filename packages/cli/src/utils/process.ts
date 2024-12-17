import type { ChildProcess} from "node:child_process";
import { spawn } from "node:child_process";

export const runProcess = (
  command: string,
  commandArgs: string[],
  cwd: string | undefined,
  environment: Record<string, string>,
  silent?: boolean,
): ChildProcess => {
  return spawn(command, commandArgs, {
    env: {
      ...process.env,
      ...environment,
    },
    cwd,
    stdio: silent ? "ignore" : "inherit",
    shell: true,
  });
};

export const terminationOf = (testProcess: ChildProcess): Promise<number | null> =>
  new Promise((resolve) => {
    testProcess.on("exit", (code) => resolve(code));
  });

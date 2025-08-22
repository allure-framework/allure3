import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";

export const runProcess = (
  command: string,
  commandArgs: string[],
  cwd: string | undefined,
  environment: Record<string, string>,
): ChildProcess => {
  return spawn(command, commandArgs, {
    env: {
      // these variables keep ascii colors in stdout/stderr
      FORCE_COLOR: "1",
      CLICOLOR_FORCE: "1",
      COLOR: "1",
      COLORTERM: "truecolor",
      TERM: "xterm-256color",
      ...process.env,
      ...environment,
    },
    cwd,
    stdio: "pipe",
    shell: true,
  });
};

export const terminationOf = (testProcess: ChildProcess): Promise<number | null> =>
  new Promise((resolve) => {
    testProcess.on("exit", (code) => resolve(code));
  });

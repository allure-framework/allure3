import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";

export const runProcess = (params: {
  command: string;
  commandArgs: string[];
  cwd: string | undefined;
  environment?: Record<string, string>;
  logs?: "pipe" | "inherit" | "ignore";
}): ChildProcess => {
  const { command, commandArgs, cwd, environment = {}, logs = "inherit" } = params;
  const env = {
    ...process.env,
    ...environment,
  };

  if (logs === "pipe") {
    // these variables keep ascii colors in stdout/stderr
    Object.assign(env, {
      FORCE_COLOR: "1",
      CLICOLOR_FORCE: "1",
      COLOR: "1",
      COLORTERM: "truecolor",
      TERM: "xterm-256color",
    });
  }

  return spawn(command, commandArgs, {
    env,
    cwd,
    stdio: logs,
    shell: true,
  });
};

export const terminationOf = (testProcess: ChildProcess): Promise<number | null> =>
  new Promise((resolve) => {
    testProcess.on("exit", (code) => resolve(code));
  });

import { exec as nodeExec } from "node:child_process";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export const executeCommand = (command: string, cwd: string): Promise<ExecResult> => {
  return new Promise((resolve) => {
    nodeExec(command, { cwd }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: error?.code ?? 0,
      });
    });
  });
};

import { invokeStdoutCliTool } from "@allurereport/reader-api";
import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import process from "node:process";
import { platform } from "process";

type StopProcessTreeOpts = {
  signal?: NodeJS.Signals;
};

type ProcessBrief = {
  parentPid: number;
  pid: number;
  command: string;
};

const IS_WIN = platform === "win32";

const PS_OUTPUT_PATTERN = /(?<ppid>\d+)\s+(?<pid>\d+)\s+(?<comm>.*)/;

export const runProcess = (params: {
  command: string;
  commandArgs: string[];
  cwd: string | undefined;
  environmentVariables?: Record<string, string>;
  logs?: "pipe" | "inherit" | "ignore";
}): ChildProcess => {
  const { command, commandArgs, cwd, environmentVariables = {}, logs = "inherit" } = params;
  const env = {
    ...process.env,
    ...environmentVariables,
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

/**
 * On a POSIX-compatible system, sends a signal (`SIGTERM` by default) to a process and all its direct and indirect
 * children. On Windows, calls ProcessTerminate on these processes instead.
 * @param pid The ID of a parent process to stop.
 * @param options Options
 * @returns An array of objects, each describing a process that has been requested to stop.
 */
export const stopProcessTree = async (
  pid: number,
  { signal = "SIGTERM" }: StopProcessTreeOpts = {},
): Promise<ProcessBrief[]> => {
  const tree = new Map<number, ProcessBrief[]>();
  const processesToSignal: ProcessBrief[] = [];
  const signaledProcesses: ProcessBrief[] = [];

  const [executable, processArgs] = IS_WIN
    ? [
        "powershell.exe",
        [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `& {
            [System.Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($False, $False)
            Get-CimInstance -Class Win32_Process | ForEach-Object {
              "$($_.ParentProcessId) $($_.ProcessId) $($_.ExecutablePath)"
            }
          }`,
        ],
      ]
    : ["ps", ["-Ao", "ppid,pid,comm"]];

  const processOptions = {
    timeout: 5000,
    encoding: "utf-8" as BufferEncoding,
  };

  for await (const line of invokeStdoutCliTool(executable, processArgs, processOptions)) {
    const match = PS_OUTPUT_PATTERN.exec(line);
    if (match) {
      const [, ppidStr, pidStr, comm] = match;
      const ppid = parseInt(ppidStr, 10);
      const entryPid = parseInt(pidStr, 10);

      const processBrief: ProcessBrief = {
        pid: entryPid,
        parentPid: ppid,
        command: comm,
      };

      if (entryPid === pid) {
        processesToSignal.push(processBrief);
      }

      const children = tree.get(ppid) ?? [];
      if (!children.length) {
        tree.set(ppid, children);
      }
      children.push(processBrief);
    }
  }

  const pidStack: number[] = [];

  for (let currentPid: number | undefined = pid; currentPid; currentPid = pidStack.shift()) {
    const children = tree.get(currentPid);
    if (children) {
      processesToSignal.push(...children);
      pidStack.push(...children.map(({ pid: childPid }) => childPid));
    }
  }

  for (const target of processesToSignal) {
    try {
      process.kill(target.pid, signal);
      signaledProcesses.push(target);
    } catch {
      // pid doesn't exists, which means the process has just exited
      // or pid denotes a process group on Windows (shouldn't be a case)
    }
  }

  return signaledProcesses;
};

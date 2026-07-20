import { fork } from "node:child_process";
import { rmSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { platform } from "node:process";

import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { runProcess, stopProcessTree, terminationOf } from "../src/utils/process.js";

const spinProcessTreeScript = `
  import { fork } from "node:child_process";
  import process from "node:process";

  const childrenDescriptors = JSON.parse(process.argv.at(-1));

  const createSignalHandler = (exitCode) => async () => {
    await reportChildrenExitCodes();
    process.exit(exitCode);
  };

  process.on("SIGTERM", createSignalHandler(10));
  process.on("SIGINT", createSignalHandler(20));

  const childPromises = {};
  const childPids = {};

  for (const [childKey, childChildren] of Object.entries(childrenDescriptors)) {
    childPids[childKey] = await new Promise((continueInit) => {
      const childProcess = fork(import.meta.filename, [JSON.stringify(childChildren)], {
        timeout: 10000,
        killSignal: "SIGKILL",
      });

      let childChildrenExitCodes;
      childProcess.on("message", ([type, data]) => {
        switch (type) {
          case "pids":
            continueInit({ pid: childProcess.pid, children: data });
            break;
          case "exitCodes":
            childChildrenExitCodes = data;
            break;
        }
      });

      childPromises[childKey] = new Promise((emitChildExitCode) => {
        childProcess.on("exit", (code, signal) => {
          emitChildExitCode({ code: signal ?? code, children: childChildrenExitCodes ?? {} });
        });
      });
    });
  }

  if (process.connected) {
    process.send(["pids", childPids]);
  }

  const reportChildrenExitCodes = async () => {
    const childExitCodes = {};
    for (const [childKey, childPromise] of Object.entries(childPromises)) {
      childExitCodes[childKey] = await childPromise;
    }
    if (process.connected) {
      process.send(["exitCodes", childExitCodes]);
    }
  };

  await new Promise((resolve) => setTimeout(resolve, 10000));
`;

type ChildrenDescriptor = Record<string, object>;

type TargetProcessMessage =
  | ["pids", Record<string, ProcessTreePids>]
  | ["exitCodes", Record<string, ProcessTreeExitCodes>];

type ProcessTreePids = {
  pid: number;
  children: Record<string, ProcessTreePids>;
};

type ProcessTreeExitCodes = {
  code: number | NodeJS.Signals;
  children: Record<string, ProcessTreeExitCodes>;
};

type ProcessRunInfo = {
  pids: ProcessTreePids;
  exitCodes: Promise<ProcessTreeExitCodes>;
};

const spinUpProcessTree = async (childrenDescriptor: ChildrenDescriptor): Promise<ProcessRunInfo> => {
  const workingDirectory = await mkdtemp(path.join(tmpdir(), "cli-test-terminate-"));
  const scriptPath = path.join(workingDirectory, "spawn.mjs");
  await writeFile(scriptPath, spinProcessTreeScript, { encoding: "utf-8" });

  const parent = fork(scriptPath, [JSON.stringify(childrenDescriptor)], {
    cwd: workingDirectory,
    timeout: 10000,
    killSignal: "SIGKILL",
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });

  parent.stdout?.setEncoding("utf-8").pipe(process.stdout);
  parent.stderr?.setEncoding("utf-8").pipe(process.stderr);

  let childExitCodes: Record<string, ProcessTreeExitCodes>;
  const childPidsPromise = new Promise<Record<string, ProcessTreePids>>((emitChildPids) => {
    parent.on("message", ([type, data]: TargetProcessMessage) => {
      if (type === "pids") {
        emitChildPids(data);
      } else if (type === "exitCodes") {
        childExitCodes = data;
      }
    });
  });

  const parentExitCodePromise = new Promise<number | NodeJS.Signals>((emitParentExitCode) => {
    parent.on("exit", (code, signal) => {
      emitParentExitCode(signal ?? code!);
    });
  }).finally(async () => {
    await syncProcessesStopped();
    rmSync(workingDirectory, { recursive: true, force: true });
  });

  const childPids = await childPidsPromise;

  const syncProcessesStopped = async () => {
    const pidsToCheck = [];
    const recordsToProcess: Record<string, ProcessTreePids>[] = [];
    for (let record = childPids; record; record = recordsToProcess.pop()!) {
      for (const [, { pid, children }] of Object.entries(record)) {
        pidsToCheck.push(pid);
        recordsToProcess.push(children);
      }
    }

    while (pidsToCheck.length) {
      await new Promise((r) => setTimeout(r, 500));
      pidsToCheck.splice(
        0,
        pidsToCheck.length,
        ...pidsToCheck.filter((pid) => {
          try {
            process.kill(pid, 0);
            return true;
          } catch (e) {
            if ((e as any).code === "ESRCH") {
              return false;
            }
            throw e;
          }
        }),
      );
    }
  };

  return {
    pids: {
      pid: parent.pid!,
      children: childPids,
    },
    exitCodes: parentExitCodePromise.then((code) => ({ code, children: childExitCodes })),
  };
};

describe("runProcess", () => {
  beforeEach(async () => {
    await epic("coverage");
    await feature("cli-run");
    await story("process");
    await label("coverage", "cli-run");
  });

  it("runs shell commands with args without Node DEP0190 warning", async () => {
    const workingDirectory = await mkdtemp(path.join(tmpdir(), "cli-test-run-process-"));
    const scriptPath = path.join(workingDirectory, "argv.mjs");

    await writeFile(scriptPath, "console.log(JSON.stringify(process.argv.slice(2)));\n", "utf-8");

    try {
      const childProcess = runProcess({
        command: process.execPath,
        commandArgs: [scriptPath, "value with spaces"],
        cwd: workingDirectory,
        logs: "pipe",
        shell: true,
      });
      let stdout = "";
      let stderr = "";

      childProcess.stdout?.setEncoding("utf8").on?.("data", (data: string) => {
        stdout += data;
      });
      childProcess.stderr?.setEncoding("utf8").on?.("data", (data: string) => {
        stderr += data;
      });

      await expect(terminationOf(childProcess)).resolves.toBe(0);
      expect(JSON.parse(stdout.trim())).toEqual(["value with spaces"]);
      expect(stderr).not.toContain("[DEP0190]");
    } finally {
      rmSync(workingDirectory, { recursive: true, force: true });
    }
  });
});

describe("stopProcessTree", () => {
  beforeEach(async () => {
    await epic("coverage");
    await feature("cli-run");
    await story("process");
    await label("coverage", "cli-run");
  });

  // stopProcessTree on Windows calls powershell.exe so it might need more time to finish
  describe("on Windows", { skip: platform != "win32", timeout: 10_000 }, () => {
    it("should stop a tree of a single process", async () => {
      const {
        pids: { pid },
        exitCodes,
      } = await spinUpProcessTree({});

      const terminations = await stopProcessTree(pid);

      expect(terminations).toEqual([expect.objectContaining({ pid })]);

      // Since the parent process is stopped via ProcessTerminate, it doesn't have a chance
      // to report the exit statuses of its children
      await expect(exitCodes).resolves.toEqual({ code: 1, children: undefined });
    });

    it("should stop a tree of a parent and one child", async () => {
      const {
        pids: {
          pid: parentPid,
          children: {
            1: { pid: childPid },
          },
        },
        exitCodes,
      } = await spinUpProcessTree({ 1: {} });

      const terminations = await stopProcessTree(parentPid);

      expect(terminations).toHaveLength(2);
      expect(terminations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ pid: parentPid }),
          expect.objectContaining({ pid: childPid }),
        ]),
      );
      await expect(exitCodes).resolves.toEqual({ code: 1, children: undefined });
    });

    it("should stop a tree of a parent and three children", async () => {
      const x = await spinUpProcessTree({ 1: {}, 2: {}, 3: {} });
      const {
        pids: {
          pid,
          children: {
            1: { pid: childPid1 },
            2: { pid: childPid2 },
            3: { pid: childPid3 },
          },
        },
        exitCodes,
      } = x;

      const terminations = await stopProcessTree(pid);

      expect(terminations).toHaveLength(4);
      expect(terminations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ pid }),
          expect.objectContaining({ pid: childPid1, parentPid: pid }),
          expect.objectContaining({ pid: childPid2, parentPid: pid }),
          expect.objectContaining({ pid: childPid3, parentPid: pid }),
        ]),
      );
      await expect(exitCodes).resolves.toEqual({ code: 1, children: undefined });
    });

    it("should stop a three-level process tree", async () => {
      const {
        pids: {
          pid,
          children: {
            1: {
              pid: pid1,
              children: {
                11: { pid: pid11 },
                12: { pid: pid12 },
              },
            },
            2: {
              pid: pid2,
              children: {
                21: { pid: pid21 },
                22: { pid: pid22 },
              },
            },
          },
        },
        exitCodes,
      } = await spinUpProcessTree({ 1: { 11: {}, 12: {} }, 2: { 21: {}, 22: {} } });

      const terminations = await stopProcessTree(pid);

      expect(terminations).toHaveLength(7);
      expect(terminations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ pid }),
          expect.objectContaining({ pid: pid1, parentPid: pid }),
          expect.objectContaining({ pid: pid2, parentPid: pid }),
          expect.objectContaining({ pid: pid11, parentPid: pid1 }),
          expect.objectContaining({ pid: pid12, parentPid: pid1 }),
          expect.objectContaining({ pid: pid21, parentPid: pid2 }),
          expect.objectContaining({ pid: pid22, parentPid: pid2 }),
        ]),
      );
      await expect(exitCodes).resolves.toEqual({ code: 1, children: undefined });
    });
  });

  describe("on a POSIX-compliant system", { skip: platform === "win32", timeout: 10_000 }, () => {
    it("should stop a tree of a single process", async () => {
      const {
        pids: { pid },
        exitCodes,
      } = await spinUpProcessTree({});

      const terminations = await stopProcessTree(pid);

      expect(terminations).toEqual([expect.objectContaining({ pid })]);
      await expect(exitCodes).resolves.toEqual({ code: 10, children: {} });
    });

    it("should use a custom signal", async () => {
      const {
        pids: { pid },
        exitCodes,
      } = await spinUpProcessTree({});

      const terminations = await stopProcessTree(pid, { signal: "SIGINT" });

      expect(terminations).toEqual([expect.objectContaining({ pid })]);
      await expect(exitCodes).resolves.toEqual({ code: 20, children: {} });
    });

    it("should stop a tree of a parent and one child", async () => {
      const {
        pids: {
          pid,
          children: {
            1: { pid: childPid },
          },
        },
        exitCodes,
      } = await spinUpProcessTree({ 1: {} });

      const terminations = await stopProcessTree(pid);

      expect(terminations).toHaveLength(2);
      expect(terminations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ pid }),
          expect.objectContaining({ pid: childPid, parentPid: pid }),
        ]),
      );
      await expect(exitCodes).resolves.toEqual({
        code: 10,
        children: {
          1: { code: 10, children: {} },
        },
      });
    });

    it("should stop a tree of a parent and three children", async () => {
      const {
        pids: {
          pid,
          children: {
            1: { pid: childPid1 },
            2: { pid: childPid2 },
            3: { pid: childPid3 },
          },
        },
        exitCodes,
      } = await spinUpProcessTree({ 1: {}, 2: {}, 3: {} });

      const terminations = await stopProcessTree(pid);

      expect(terminations).toHaveLength(4);
      expect(terminations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ pid }),
          expect.objectContaining({ pid: childPid1, parentPid: pid }),
          expect.objectContaining({ pid: childPid2, parentPid: pid }),
          expect.objectContaining({ pid: childPid3, parentPid: pid }),
        ]),
      );
      await expect(exitCodes).resolves.toEqual({
        code: 10,
        children: {
          1: { code: 10, children: {} },
          2: { code: 10, children: {} },
          3: { code: 10, children: {} },
        },
      });
    });

    it("should stop a three-level process tree", async () => {
      const {
        pids: {
          pid,
          children: {
            1: {
              pid: pid1,
              children: {
                11: { pid: pid11 },
                12: { pid: pid12 },
              },
            },
            2: {
              pid: pid2,
              children: {
                21: { pid: pid21 },
                22: { pid: pid22 },
              },
            },
          },
        },
        exitCodes,
      } = await spinUpProcessTree({ 1: { 11: {}, 12: {} }, 2: { 21: {}, 22: {} } });

      const terminations = await stopProcessTree(pid);

      expect(terminations).toHaveLength(7);
      expect(terminations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ pid }),
          expect.objectContaining({ pid: pid1, parentPid: pid }),
          expect.objectContaining({ pid: pid2, parentPid: pid }),
          expect.objectContaining({ pid: pid11, parentPid: pid1 }),
          expect.objectContaining({ pid: pid12, parentPid: pid1 }),
          expect.objectContaining({ pid: pid21, parentPid: pid2 }),
          expect.objectContaining({ pid: pid22, parentPid: pid2 }),
        ]),
      );
      await expect(exitCodes).resolves.toEqual({
        code: 10,
        children: {
          1: {
            code: 10,
            children: {
              11: { code: 10, children: {} },
              12: { code: 10, children: {} },
            },
          },
          2: {
            code: 10,
            children: {
              21: { code: 10, children: {} },
              22: { code: 10, children: {} },
            },
          },
        },
      });
    });
  });
});

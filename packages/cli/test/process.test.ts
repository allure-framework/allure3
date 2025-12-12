import { fork } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { killTree } from "../src/utils/process.js";

const targetScript = `
  import { fork } from "node:child_process";
  import process from "node:process";

  const [expectedSignal, childrenStr] = process.argv.slice(-2);

  let reporting = false;

  process.on(expectedSignal, async () => {
    await reportChildren();
    process.removeAllListeners(expectedSignal);
    process.kill(process.pid, expectedSignal);
  });

  const childrenDescriptors = JSON.parse(childrenStr);

  const childrenResultPromises = {};
  const childrenInitInfo = {};

  for (const [childKey, grandchildren] of Object.entries(childrenDescriptors)) {
    let continueInit;
    let failInit;
    const initFence = new Promise((resolve, reject) => {
      continueInit = resolve;
      failInit = reject;
    });

    const childProcess = fork(import.meta.filename, [expectedSignal, JSON.stringify(grandchildren)]);

    let childChildrenResults;
    childProcess.on("message", ([type, data]) => {
      switch (type) {
        case "init":
          childrenInitInfo[childKey] = { children: data };
          continueInit();
          break;
        case "exit":
          childChildrenResults = data;
          break;
      }
    });

    let emitChildExitInfo;
    const childPromise = new Promise((resolve) => {
      emitChildExitInfo = resolve;
    });
    childProcess.on("exit", (code, signal) => {
      emitChildExitInfo({ reason: code ?? signal, children: childChildrenResults });
    });

    childrenResultPromises[childKey] = childPromise;

    const timeout = setTimeout(() => failInit(new Error("Unable to init the process tree")), 3000);
    await initFence;
    clearTimeout(timeout);
    childrenInitInfo[childKey].pid = childProcess.pid;
  }

  if (process.connected) {
    process.send(["init", childrenInitInfo]);
  }

  const reportChildren = async () => {
    if (reporting) {
      return;
    }

    reporting = true;

    const childrenExitInfo = {};
    for (const [childKey, childPromise] of Object.entries(childrenResultPromises)) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(\`Child process \${childKey} not responding\`)), 3000);
        childPromise.then(({ reason, children: childChildren }) => {
          clearTimeout(timeout);
          childrenExitInfo[childKey] = {
            reason,
            children: childChildren,
          };
          resolve();
        }, reject);
      });
    }
    if (process.connected) {
      process.send(["exit", childrenExitInfo]);
    }
  };

  await new Promise((resolve) => setTimeout(resolve, 3000));
  await reportChildren();
`;

type ChildrenDescriptor = Record<string, object>;

type TargetProcessMessage = ["init", Record<string, ProcessInitInfo>] | ["exit", Record<string, ProcessExitInfo>];

type ProcessInitInfo = {
  pid: number;
  children: Record<string, ProcessInitInfo>;
};

type ProcessExitInfo = {
  reason: ExitReason;
  children: Record<string, ProcessExitInfo>;
};

type ExitReason = number | NodeJS.Signals;

type ProcessRunInfo = {
  initInfo: ProcessInitInfo;
  exitInfo: Promise<ProcessExitInfo>;
};

const spinUpProcessTree = async (
  expectedSignal: NodeJS.Signals,
  childrenDescriptor: ChildrenDescriptor,
): Promise<ProcessRunInfo> => {
  const workingDirectory = await mkdtemp(path.join(tmpdir(), "cli-test-terminate-"));
  try {
    const scriptPath = path.join(workingDirectory, "spawn.mjs");
    await writeFile(scriptPath, targetScript, { encoding: "utf-8" });
    const parent = fork(scriptPath, [expectedSignal, JSON.stringify(childrenDescriptor)], {
      cwd: workingDirectory,
      timeout: 3000,
      killSignal: "SIGKILL",
    });

    let continueInit: () => void;
    let raiseError: (e: Error) => void;
    const initFence = new Promise((resolve, reject) => {
      continueInit = () => resolve(undefined);
      raiseError = reject;
    });

    let emitExitInfo: (exitInfo: ProcessExitInfo) => void;
    const exitInfoPromise = new Promise<ProcessExitInfo>((resolve) => (emitExitInfo = resolve));

    let childrenInitInfo: Record<string, ProcessInitInfo> = {};
    let childrenExitInfo: Record<string, ProcessExitInfo> = {};

    parent.on("error", (e) => raiseError(e));
    parent.on("message", ([type, data]: TargetProcessMessage) => {
      switch (type) {
        case "init":
          childrenInitInfo = data;
          continueInit();
          break;
        case "exit":
          childrenExitInfo = data;
          break;
      }
    });
    parent.on("exit", (code, actualSignal) => {
      continueInit();
      emitExitInfo({
        reason: code ?? actualSignal!,
        children: childrenExitInfo,
      });
    });

    await initFence;

    return { initInfo: { pid: parent.pid!, children: childrenInitInfo }, exitInfo: exitInfoPromise };
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
};

describe("terminate", () => {
  it("should terminate a single process", async () => {
    const {
      initInfo: { pid },
      exitInfo,
    } = await spinUpProcessTree("SIGTERM", {});

    const terminations = await killTree(pid);

    expect(terminations).toEqual([expect.objectContaining({ pid })]);
    await expect(exitInfo).resolves.toEqual({ reason: "SIGTERM", children: {} });
  });

  it("should use a custom signal", async () => {
    const {
      initInfo: { pid },
      exitInfo,
    } = await spinUpProcessTree("SIGINT", {});

    const terminations = await killTree(pid, "SIGINT");

    expect(terminations).toEqual([expect.objectContaining({ pid })]);
    await expect(exitInfo).resolves.toEqual({ reason: "SIGINT", children: {} });
  });

  it("should terminate a child process", async () => {
    const {
      initInfo: {
        pid,
        children: {
          1: { pid: childPid },
        },
      },
      exitInfo,
    } = await spinUpProcessTree("SIGTERM", { 1: {} });

    const terminations = await killTree(pid);

    expect(terminations).toHaveLength(2);
    expect(terminations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pid }),
        expect.objectContaining({ pid: childPid, parentPid: pid }),
      ]),
    );
    await expect(exitInfo).resolves.toEqual({
      reason: "SIGTERM",
      children: {
        1: { reason: "SIGTERM", children: {} },
      },
    });
  });

  it("should terminate multiple child processes", async () => {
    const {
      initInfo: {
        pid,
        children: {
          1: { pid: childPid1 },
          2: { pid: childPid2 },
          3: { pid: childPid3 },
        },
      },
      exitInfo,
    } = await spinUpProcessTree("SIGTERM", { 1: {}, 2: {}, 3: {} });

    const terminations = await killTree(pid);

    expect(terminations).toHaveLength(4);
    expect(terminations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pid }),
        expect.objectContaining({ pid: childPid1, parentPid: pid }),
        expect.objectContaining({ pid: childPid2, parentPid: pid }),
        expect.objectContaining({ pid: childPid3, parentPid: pid }),
      ]),
    );
    await expect(exitInfo).resolves.toEqual({
      reason: "SIGTERM",
      children: {
        1: { reason: "SIGTERM", children: {} },
        2: { reason: "SIGTERM", children: {} },
        3: { reason: "SIGTERM", children: {} },
      },
    });
  });

  it("should terminate multi-level process tree", async () => {
    const {
      initInfo: {
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
      exitInfo,
    } = await spinUpProcessTree("SIGTERM", { 1: { 11: {}, 12: {} }, 2: { 21: {}, 22: {} } });

    const terminations = await killTree(pid);

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
    await expect(exitInfo).resolves.toEqual({
      reason: "SIGTERM",
      children: {
        1: {
          reason: "SIGTERM",
          children: {
            11: { reason: "SIGTERM", children: {} },
            12: { reason: "SIGTERM", children: {} },
          },
        },
        2: {
          reason: "SIGTERM",
          children: {
            21: { reason: "SIGTERM", children: {} },
            22: { reason: "SIGTERM", children: {} },
          },
        },
      },
    });
  });
});

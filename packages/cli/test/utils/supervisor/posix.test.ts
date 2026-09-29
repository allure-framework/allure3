import { once } from "node:events";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PosixProcessSupervisor } from "../../../src/utils/supervisor/index.js";
import { nodeScripts } from "./posix.scripts.js";
import { SupervisorFixture, expectProcesses } from "./supervisor.helpers.js";

describe("PosixProcessSupervisor", { skip: process.platform === "win32" }, () => {
  beforeEach(async () => {
    await epic("coverage");
    await feature("cli-run");
    await story("posix-process-supervisor");
    await label("coverage", "cli-run");
  });

  describe("natural command completion", () => {
    it.each([
      {
        description: "a successful command",
        expectedExitCode: 0,
        expectedStdout: "successful stdout",
        expectedStderr: "successful stderr",
      },
      {
        description: "a command with a non-zero exit code",
        expectedExitCode: 23,
        expectedStdout: "failed stdout",
        expectedStderr: "failed stderr",
      },
    ])("reports the completion and captured output for $description", async (testCase) => {
      const supervisor = new PosixProcessSupervisor(process.execPath, {
        arguments: [
          "--input-type=module",
          "--eval",
          nodeScripts.writeOutputAndExit,
          testCase.expectedStdout,
          testCase.expectedStderr,
          String(testCase.expectedExitCode),
        ],
        silent: true,
      });

      supervisor.start();

      expect(supervisor.started).toBe(true);
      expect(supervisor.completed).toBe(false);
      await expect(supervisor.completion).resolves.toEqual({ code: testCase.expectedExitCode, signal: null });
      expect(supervisor.completed).toBe(true);
      await expect(supervisor.exitCode).resolves.toBe(testCase.expectedExitCode);
      await expect(supervisor.signal).resolves.toBeNull();
      await expect(supervisor.stdout).resolves.toBe(testCase.expectedStdout);
      await expect(supervisor.stderr).resolves.toBe(testCase.expectedStderr);
    });

    it("waits for the process group after the root process exits", async ({ onTestFinished }) => {
      const fixture = await SupervisorFixture.create();
      const descendantScriptPath = fixture.resolvePath("descendant.mjs");
      const rootScriptPath = fixture.resolvePath("root.mjs");
      const supervisor = new PosixProcessSupervisor(process.execPath, {
        arguments: [
          rootScriptPath,
          descendantScriptPath,
          fixture.resolvePath("descendant-ready"),
          fixture.resolvePath("descendant-release"),
        ],
        silent: true,
      });

      onTestFinished(() =>
        fixture.cleanup({
          beforeTerminate: () => fixture.touchFile("descendant-release"),
          supervisor,
        }),
      );

      await fixture.writeScript("descendant.mjs", nodeScripts.descendant);
      await fixture.writeScript("root.mjs", nodeScripts.rootWithDescendant);

      supervisor.start();

      const [rootExitCode, rootSignal] = await once(supervisor.process, "close");

      expect(supervisor.started).toBe(true);
      expect(supervisor.completed).toBe(false);

      const descendantPid = await fixture.readProcessId("descendant-ready");

      expect(rootExitCode).toBe(0);
      expect(rootSignal).toBeNull();

      expectProcesses([descendantPid]).toBeAlive();

      await expect(
        Promise.race([supervisor.completion.then(() => "completed" as const), delay(50, "pending" as const)]),
      ).resolves.toBe("pending");
      expect(supervisor.completed).toBe(false);

      await fixture.touchFile("descendant-release");

      await expect(supervisor.completion).resolves.toEqual({ code: 0, signal: null });
      expect(supervisor.completed).toBe(true);

      expectProcesses([descendantPid]).toBeDead();

      // The process group does should not exist anymore.
      expect(() => process.kill(-supervisor.process.pid!, 0)).toThrow(expect.objectContaining({ code: "ESRCH" }));
    });
  });

  describe("terminate", () => {
    it("kills a three-level process tree", async ({ onTestFinished }) => {
      const fixture = await SupervisorFixture.create();
      const treeScriptPath = fixture.resolvePath("three-level-tree.mjs");
      const supervisor = new PosixProcessSupervisor(process.execPath, {
        arguments: [treeScriptPath, "0", fixture.workingDirectory],
        silent: true,
      });

      onTestFinished(() => fixture.cleanup({ supervisor }));

      await fixture.writeScript("three-level-tree.mjs", nodeScripts.threeLevelTree);

      supervisor.start();

      const rootPid = supervisor.process.pid!;

      const processIds = await Promise.all([0, 1, 2].map((level) => fixture.readProcessId(`level-${level}.pid`)));

      expect(processIds[0]).toBe(rootPid);
      expect(supervisor.started).toBe(true);
      expect(supervisor.completed).toBe(false);
      expect(() => process.kill(-rootPid, 0)).not.toThrow();
      expectProcesses(processIds).toBeAlive();

      await supervisor.terminate();

      expect(supervisor.completed).toBe(true);
      await expect(supervisor.completion).resolves.toEqual({ code: null, signal: "SIGKILL" });
      expectProcesses(processIds).toBeDead();
      expect(() => process.kill(-rootPid, 0)).toThrow(expect.objectContaining({ code: "ESRCH" }));
    });

    it("reuses one termination operation for repeated calls", async ({ onTestFinished }) => {
      const fixture = await SupervisorFixture.create();
      const treeScriptPath = fixture.resolvePath("three-level-tree.mjs");
      const supervisor = new PosixProcessSupervisor(process.execPath, {
        arguments: [treeScriptPath, "0", fixture.workingDirectory],
        silent: true,
      });

      onTestFinished(() => fixture.cleanup({ supervisor }));

      await fixture.writeScript("three-level-tree.mjs", nodeScripts.threeLevelTree);

      supervisor.start();

      const rootPid = supervisor.process.pid!;
      const processIds = await Promise.all([0, 1, 2].map((level) => fixture.readProcessId(`level-${level}.pid`)));
      const killMock = vi.spyOn(process, "kill");

      try {
        const firstTermination = supervisor.terminate();
        const secondTermination = supervisor.terminate();

        expect(secondTermination).toBe(firstTermination);

        await firstTermination;

        expect(supervisor.terminate()).toBe(firstTermination);
        expect(killMock.mock.calls.filter(([pid, signal]) => pid === -rootPid && signal === "SIGKILL")).toHaveLength(1);
        await expect(supervisor.completion).resolves.toEqual({ code: null, signal: "SIGKILL" });
        expect(supervisor.completed).toBe(true);
        expectProcesses(processIds).toBeDead();
      } finally {
        killMock.mockRestore();
      }
    });
  });

  describe("stop", () => {
    it("stops gracefully after signalling only the root process", async ({ onTestFinished }) => {
      const fixture = await SupervisorFixture.create();
      const treeScriptPath = fixture.resolvePath("three-level-tree.mjs");
      const supervisor = new PosixProcessSupervisor(process.execPath, {
        arguments: [treeScriptPath, "0", fixture.workingDirectory, "graceful-stop"],
        silent: true,
        stopTimeout: 500,
      });

      onTestFinished(() => fixture.cleanup({ supervisor }));

      await fixture.writeScript("three-level-tree.mjs", nodeScripts.threeLevelTree);

      supervisor.start();

      const rootPid = supervisor.process.pid!;
      const processIds = await Promise.all([0, 1, 2].map((level) => fixture.readProcessId(`level-${level}.pid`)));

      expectProcesses(processIds).toBeAlive();

      await supervisor.stop();

      const signalledRootPid = await fixture.readProcessId("level-0.sigint");

      expect(signalledRootPid).toBe(rootPid);
      expect(fixture.fileExists("level-1.sigint")).toBe(false);
      expect(fixture.fileExists("level-2.sigint")).toBe(false);
      await expect(supervisor.completion).resolves.toEqual({ code: 20, signal: null });
      expect(supervisor.completed).toBe(true);
      expectProcesses(processIds).toBeDead();
      expect(() => process.kill(-rootPid, 0)).toThrow(expect.objectContaining({ code: "ESRCH" }));
    });

    it("escalates to SIGKILL when the root process ignores SIGINT", async ({ onTestFinished }) => {
      const fixture = await SupervisorFixture.create();
      const treeScriptPath = fixture.resolvePath("three-level-tree.mjs");
      const supervisor = new PosixProcessSupervisor(process.execPath, {
        arguments: [treeScriptPath, "0", fixture.workingDirectory, "ignore"],
        silent: true,
        stopTimeout: 100,
      });

      onTestFinished(() => fixture.cleanup({ supervisor }));

      await fixture.writeScript("three-level-tree.mjs", nodeScripts.threeLevelTree);

      supervisor.start();

      const rootPid = supervisor.process.pid!;
      const processIds = await Promise.all([0, 1, 2].map((level) => fixture.readProcessId(`level-${level}.pid`)));

      expectProcesses(processIds).toBeAlive();

      await supervisor.stop();

      const signalledRootPid = await fixture.readProcessId("level-0.sigint");

      expect(signalledRootPid).toBe(rootPid);
      expect(fixture.fileExists("level-1.sigint")).toBe(false);
      expect(fixture.fileExists("level-2.sigint")).toBe(false);
      await expect(supervisor.completion).resolves.toEqual({ code: null, signal: "SIGKILL" });
      expect(supervisor.completed).toBe(true);
      expectProcesses(processIds).toBeDead();
      expect(() => process.kill(-rootPid, 0)).toThrow(expect.objectContaining({ code: "ESRCH" }));
    });

    it("reuses one graceful stop operation for repeated calls", async ({ onTestFinished }) => {
      const fixture = await SupervisorFixture.create();
      const treeScriptPath = fixture.resolvePath("three-level-tree.mjs");
      const supervisor = new PosixProcessSupervisor(process.execPath, {
        arguments: [treeScriptPath, "0", fixture.workingDirectory, "graceful-stop"],
        silent: true,
        stopTimeout: 500,
      });

      onTestFinished(() => fixture.cleanup({ supervisor }));

      await fixture.writeScript("three-level-tree.mjs", nodeScripts.threeLevelTree);

      supervisor.start();

      const rootPid = supervisor.process.pid!;
      const processIds = await Promise.all([0, 1, 2].map((level) => fixture.readProcessId(`level-${level}.pid`)));
      const rootKillMock = vi.spyOn(supervisor.process, "kill");

      try {
        const firstStop = supervisor.stop();
        const secondStop = supervisor.stop();

        expect(secondStop).toBe(firstStop);

        await firstStop;

        expect(supervisor.stop()).toBe(firstStop);
        expect(rootKillMock).toHaveBeenCalledTimes(1);
        expect(rootKillMock).toHaveBeenCalledWith("SIGINT");
        expect(await fixture.readProcessId("level-0.sigint")).toBe(rootPid);
        await expect(supervisor.completion).resolves.toEqual({ code: 20, signal: null });
        expect(supervisor.completed).toBe(true);
        expectProcesses(processIds).toBeDead();
      } finally {
        rootKillMock.mockRestore();
      }
    });
  });

  describe("SIGINT", () => {
    it("forwards the first signal to a three-level process tree", async ({ onTestFinished }) => {
      const fixture = await SupervisorFixture.create();
      const treeScriptPath = fixture.resolvePath("three-level-tree.mjs");
      const supervisor = new PosixProcessSupervisor(process.execPath, {
        arguments: [treeScriptPath, "0", fixture.workingDirectory],
        silent: true,
      });
      const existingSigintListeners = new Set(process.listeners("SIGINT"));

      onTestFinished(() => fixture.cleanup({ supervisor }));

      await fixture.writeScript("three-level-tree.mjs", nodeScripts.threeLevelTree);

      supervisor.start();

      const rootPid = supervisor.process.pid!;
      const processIds = await Promise.all([0, 1, 2].map((level) => fixture.readProcessId(`level-${level}.pid`)));
      const supervisorSigintListeners = process
        .listeners("SIGINT")
        .filter((listener) => !existingSigintListeners.has(listener));

      expect(supervisorSigintListeners).toHaveLength(1);
      expectProcesses(processIds).toBeAlive();
      expect(supervisor.completed).toBe(false);

      supervisorSigintListeners[0]!("SIGINT");

      await expect(supervisor.completion).resolves.toEqual({ code: 20, signal: null });

      const signalledProcessIds = await Promise.all(
        [0, 1, 2].map((level) => fixture.readProcessId(`level-${level}.sigint`)),
      );

      expect(signalledProcessIds).toEqual(processIds);
      expect(supervisor.completed).toBe(true);
      expectProcesses(processIds).toBeDead();
      expect(() => process.kill(-rootPid, 0)).toThrow(expect.objectContaining({ code: "ESRCH" }));
      expect(process.listeners("SIGINT")).not.toContain(supervisorSigintListeners[0]);
    });

    it("terminates the process tree on the second signal without terminating the supervisor", async ({
      onTestFinished,
    }) => {
      const fixture = await SupervisorFixture.create();
      const treeScriptPath = fixture.resolvePath("three-level-tree.mjs");
      const supervisor = new PosixProcessSupervisor(process.execPath, {
        arguments: [treeScriptPath, "0", fixture.workingDirectory, "ignore"],
        silent: true,
      });
      const existingSigintListeners = new Set(process.listeners("SIGINT"));

      onTestFinished(() => fixture.cleanup({ supervisor }));

      await fixture.writeScript("three-level-tree.mjs", nodeScripts.threeLevelTree);

      supervisor.start();

      const rootPid = supervisor.process.pid!;
      const processIds = await Promise.all([0, 1, 2].map((level) => fixture.readProcessId(`level-${level}.pid`)));
      const supervisorSigintListeners = process
        .listeners("SIGINT")
        .filter((listener) => !existingSigintListeners.has(listener));

      expect(supervisorSigintListeners).toHaveLength(1);
      expectProcesses(processIds).toBeAlive();

      supervisorSigintListeners[0]!("SIGINT");

      const signalledProcessIds = await Promise.all(
        [0, 1, 2].map((level) => fixture.readProcessId(`level-${level}.sigint`)),
      );

      expect(signalledProcessIds).toEqual(processIds);
      expectProcesses(processIds).toBeAlive();
      expect(supervisor.completed).toBe(false);

      supervisorSigintListeners[0]!("SIGINT");

      await expect(supervisor.completion).resolves.toEqual({ code: null, signal: "SIGKILL" });

      expect(supervisor.completed).toBe(true);
      expectProcesses(processIds).toBeDead();
      expect(() => process.kill(-rootPid, 0)).toThrow(expect.objectContaining({ code: "ESRCH" }));
      expect(process.listeners("SIGINT")).not.toContain(supervisorSigintListeners[0]);
      expect(() => process.kill(process.pid, 0)).not.toThrow();
    });
  });

  describe("SIGTERM", () => {
    it("kills the process tree before passing the signal through to the supervisor", async ({ onTestFinished }) => {
      const fixture = await SupervisorFixture.create();
      const treeScriptPath = fixture.resolvePath("three-level-tree.mjs");
      const supervisor = new PosixProcessSupervisor(process.execPath, {
        arguments: [treeScriptPath, "0", fixture.workingDirectory],
        silent: true,
      });
      const existingSigtermListeners = new Set(process.listeners("SIGTERM"));

      onTestFinished(() => fixture.cleanup({ supervisor }));

      await fixture.writeScript("three-level-tree.mjs", nodeScripts.threeLevelTree);

      supervisor.start();

      const rootPid = supervisor.process.pid!;
      const processIds = await Promise.all([0, 1, 2].map((level) => fixture.readProcessId(`level-${level}.pid`)));
      const supervisorSigtermListeners = process
        .listeners("SIGTERM")
        .filter((listener) => !existingSigtermListeners.has(listener));
      const realKill = process.kill.bind(process);
      const exitMock = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
      let resolveSelfSigterm!: () => void;
      const selfSigterm = new Promise<void>((resolve) => {
        resolveSelfSigterm = resolve;
      });
      let processGroupWasDeadBeforeSelfSigterm = false;
      const killMock = vi.spyOn(process, "kill").mockImplementation((pid, signal) => {
        if (pid === process.pid && signal === "SIGTERM") {
          try {
            realKill(-rootPid, 0);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ESRCH") {
              processGroupWasDeadBeforeSelfSigterm = true;
            } else {
              throw error;
            }
          }

          resolveSelfSigterm();
          return true;
        }

        return realKill(pid, signal);
      });

      try {
        expect(supervisorSigtermListeners).toHaveLength(1);
        expectProcesses(processIds).toBeAlive();
        expect(supervisor.completed).toBe(false);

        supervisorSigtermListeners[0]!("SIGTERM");

        await expect(supervisor.completion).resolves.toEqual({ code: null, signal: "SIGKILL" });
        await selfSigterm;

        expect(processGroupWasDeadBeforeSelfSigterm).toBe(true);
        expect(supervisor.completed).toBe(true);
        expectProcesses(processIds).toBeDead();
        expect(killMock).toHaveBeenCalledWith(-rootPid, "SIGKILL");
        expect(killMock).toHaveBeenCalledWith(process.pid, "SIGTERM");
        expect(exitMock).not.toHaveBeenCalled();
        expect(process.listeners("SIGTERM")).not.toContain(supervisorSigtermListeners[0]);
      } finally {
        killMock.mockRestore();
        exitMock.mockRestore();
      }
    });
  });
});

import { spawnSync } from "node:child_process";
import { once } from "node:events";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { PosixProcessSupervisor } from "../../../src/utils/supervisor/index.js";
import { nodeScripts, perlScripts } from "./posix.scripts.js";
import { SupervisorFixture, expectProcesses } from "./supervisor.helpers.js";

const perlProbe =
  process.platform === "win32"
    ? undefined
    : spawnSync("perl", ["-MPOSIX=_exit,setsid", "-e", "exit 0"], { encoding: "utf-8" });
const perlAvailable = perlProbe?.status === 0;
const runningInGitHubActions = Boolean(process.env.GITHUB_ACTIONS);

const requirePerl = (skip: (note?: string | undefined) => void) => {
  if (perlAvailable) {
    return;
  }

  const probeFailure = perlProbe?.error?.message || perlProbe?.stderr?.trim() || "Perl was not found";

  if (runningInGitHubActions) {
    throw new Error(`Perl with POSIX::setsid is required in GitHub Actions: ${probeFailure}`);
  } else {
    skip(`Perl with POSIX::_exit and POSIX::setsid is unavailable: ${probeFailure}`);
  }
};

const expectProcessGroupToBeAddressable = (processGroupId: number) => {
  try {
    process.kill(-processGroupId, 0);
  } catch (error) {
    expect(error).toEqual(expect.objectContaining({ code: "EPERM" }));
  }
};

describe("PosixProcessSupervisor", { skip: process.platform === "win32", timeout: 45_000 }, () => {
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

      await supervisor.start();

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

      await supervisor.start();

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

    it("completes for a process group containing zombies only", async ({ onTestFinished, skip }) => {
      requirePerl(skip);

      const fixture = await SupervisorFixture.create();
      const scriptPath = fixture.resolvePath("zombie-only-process-group.pl");
      const keeperPidPath = "keeper.pid";
      const zombiePidPath = "zombie.pid";
      const releasePath = "keeper-release";
      const supervisor = new PosixProcessSupervisor("perl", {
        arguments: [
          scriptPath,
          fixture.resolvePath(keeperPidPath),
          fixture.resolvePath(zombiePidPath),
          fixture.resolvePath("zombie-ready"),
          fixture.resolvePath(releasePath),
        ],
        stdio: "ignore",
      });
      let keeperPid: number | undefined;

      onTestFinished(() =>
        fixture.cleanup({
          beforeTerminate: async () => {
            await fixture.touchFile(releasePath);

            if (keeperPid !== undefined) {
              await vi.waitFor(
                () => {
                  expect(() => process.kill(keeperPid!, 0)).toThrow(expect.objectContaining({ code: "ESRCH" }));
                },
                { timeout: 5_000, interval: 25 },
              );
            }
          },
          supervisor,
        }),
      );

      await fixture.writeScript("zombie-only-process-group.pl", perlScripts.zombieOnlyProcessGroup);
      await supervisor.start();

      const rootPid = supervisor.process.pid!;
      const [rootExitCode, rootSignal] = await once(supervisor.process, "close");
      keeperPid = await fixture.readProcessId(keeperPidPath);
      const zombiePid = await fixture.readProcessId(zombiePidPath);

      expect(rootExitCode).toBe(0);
      expect(rootSignal).toBeNull();
      expectProcesses([zombiePid]).toBeAlive();
      expectProcessGroupToBeAddressable(rootPid);
      expect(supervisor.completed).toBe(false);

      await expect(supervisor.completion).resolves.toEqual({ code: 0, signal: null });
      expect(supervisor.completed).toBe(true);
      expectProcesses([zombiePid]).toBeAlive();
      expectProcessGroupToBeAddressable(rootPid);
    });
  });

  describe("terminate", () => {
    it("reports forced termination when the root exited successfully but a descendant remains", async ({
      onTestFinished,
    }) => {
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

      await supervisor.start();

      const [rootExitCode, rootSignal] = await once(supervisor.process, "close");
      const descendantPid = await fixture.readProcessId("descendant-ready");

      expect(rootExitCode).toBe(0);
      expect(rootSignal).toBeNull();
      expect(supervisor.completed).toBe(false);
      expectProcesses([descendantPid]).toBeAlive();

      await supervisor.terminate();

      await expect(supervisor.completion).resolves.toEqual({ code: null, signal: "SIGKILL" });
      expect(supervisor.completed).toBe(true);
      expectProcesses([descendantPid]).toBeDead();
    });

    it("kills a three-level process tree", async ({ onTestFinished }) => {
      const fixture = await SupervisorFixture.create();
      const treeScriptPath = fixture.resolvePath("three-level-tree.mjs");
      const supervisor = new PosixProcessSupervisor(process.execPath, {
        arguments: [treeScriptPath, "0", fixture.workingDirectory],
        silent: true,
      });

      onTestFinished(() => fixture.cleanup({ supervisor }));

      await fixture.writeScript("three-level-tree.mjs", nodeScripts.threeLevelTree);

      await supervisor.start();

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

      await supervisor.start();

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
    const expectTerminateInterruptsPendingStop = async (
      stopOptions: Parameters<PosixProcessSupervisor["stop"]>[0],
      registerCleanup: (cleanup: () => void | Promise<void>) => void,
    ) => {
      const fixture = await SupervisorFixture.create();
      const treeScriptPath = fixture.resolvePath("three-level-tree.mjs");
      const supervisor = new PosixProcessSupervisor(process.execPath, {
        arguments: [treeScriptPath, "0", fixture.workingDirectory, "ignore"],
        silent: true,
      });

      registerCleanup(() => fixture.cleanup({ supervisor }));

      await fixture.writeScript("three-level-tree.mjs", nodeScripts.threeLevelTree);

      await supervisor.start();

      const rootPid = supervisor.process.pid!;
      const processIds = await Promise.all([0, 1, 2].map((level) => fixture.readProcessId(`level-${level}.pid`)));

      expectProcesses(processIds).toBeAlive();

      const stopping = supervisor.stop(stopOptions);

      const signalledProcessIds = await Promise.all(
        [0, 1, 2].map((level) => fixture.readProcessId(`level-${level}.sigint`)),
      );

      expect(signalledProcessIds).toEqual(processIds);
      await expect(
        Promise.race([stopping.then(() => "completed" as const), delay(50, "pending" as const)]),
      ).resolves.toBe("pending");
      expect(supervisor.completed).toBe(false);
      expectProcesses(processIds).toBeAlive();

      const terminating = supervisor.terminate();
      const operations = Promise.all([stopping, terminating]).then(() => "completed" as const);

      await expect(Promise.race([operations, delay(2_000, "timeout" as const, { ref: false })])).resolves.toBe(
        "completed",
      );
      await expect(supervisor.completion).resolves.toEqual({ code: null, signal: "SIGKILL" });
      expect(supervisor.completed).toBe(true);
      expectProcesses(processIds).toBeDead();
      expect(() => process.kill(-rootPid, 0)).toThrow(expect.objectContaining({ code: "ESRCH" }));
    };

    it("stops gracefully after signalling the process group", async ({ onTestFinished }) => {
      const fixture = await SupervisorFixture.create();
      const treeScriptPath = fixture.resolvePath("three-level-tree.mjs");
      const supervisor = new PosixProcessSupervisor(process.execPath, {
        arguments: [treeScriptPath, "0", fixture.workingDirectory, "graceful-stop"],
        silent: true,
      });

      onTestFinished(() => fixture.cleanup({ supervisor }));

      await fixture.writeScript("three-level-tree.mjs", nodeScripts.threeLevelTree);

      await supervisor.start();

      const rootPid = supervisor.process.pid!;
      const processIds = await Promise.all([0, 1, 2].map((level) => fixture.readProcessId(`level-${level}.pid`)));

      expectProcesses(processIds).toBeAlive();

      await supervisor.stop();

      const signalledProcessIds = await Promise.all(
        [0, 1, 2].map((level) => fixture.readProcessId(`level-${level}.sigint`)),
      );

      expect(signalledProcessIds).toEqual(processIds);
      await expect(supervisor.completion).resolves.toEqual({ code: 20, signal: null });
      expect(supervisor.completed).toBe(true);
      expectProcesses(processIds).toBeDead();
      expect(() => process.kill(-rootPid, 0)).toThrow(expect.objectContaining({ code: "ESRCH" }));
    });

    it("supports escalation when the process group ignores SIGINT", async ({ onTestFinished }) => {
      const fixture = await SupervisorFixture.create();
      const treeScriptPath = fixture.resolvePath("three-level-tree.mjs");
      const supervisor = new PosixProcessSupervisor(process.execPath, {
        arguments: [treeScriptPath, "0", fixture.workingDirectory, "ignore"],
        silent: true,
      });

      onTestFinished(() => fixture.cleanup({ supervisor }));

      await fixture.writeScript("three-level-tree.mjs", nodeScripts.threeLevelTree);

      await supervisor.start();

      const rootPid = supervisor.process.pid!;
      const processIds = await Promise.all([0, 1, 2].map((level) => fixture.readProcessId(`level-${level}.pid`)));

      expectProcesses(processIds).toBeAlive();

      await supervisor.stop({ escalate: true, escalationTimeout: 100 });

      const signalledProcessIds = await Promise.all(
        [0, 1, 2].map((level) => fixture.readProcessId(`level-${level}.sigint`)),
      );

      expect(signalledProcessIds).toEqual(processIds);
      await expect(supervisor.completion).resolves.toEqual({ code: null, signal: "SIGKILL" });
      expect(supervisor.completed).toBe(true);
      expectProcesses(processIds).toBeDead();
      expect(() => process.kill(-rootPid, 0)).toThrow(expect.objectContaining({ code: "ESRCH" }));
    });

    it("delivers SIGINT to a test runner behind a shell", async ({ onTestFinished }) => {
      const fixture = await SupervisorFixture.create();
      const runnerScriptPath = fixture.resolvePath("runner.mjs");
      const runnerReadyPath = "runner-ready.pid";
      const runnerSigintPath = "runner-sigint.pid";
      const supervisor = new PosixProcessSupervisor("/bin/sh", {
        arguments: [
          "-c",
          '"$1" "$2" "$3" "$4"; exit $?',
          "allure-test-shell",
          process.execPath,
          runnerScriptPath,
          fixture.resolvePath(runnerReadyPath),
          fixture.resolvePath(runnerSigintPath),
        ],
        silent: true,
      });

      onTestFinished(() => fixture.cleanup({ supervisor }));

      await fixture.writeScript("runner.mjs", nodeScripts.sigintReporter);
      await supervisor.start();

      const rootPid = supervisor.process.pid!;
      const runnerPid = await fixture.readProcessId(runnerReadyPath);

      expectProcesses([rootPid, runnerPid]).toBeAlive();

      await supervisor.stop();

      await expect(fixture.readProcessId(runnerSigintPath)).resolves.toBe(runnerPid);
      expect(supervisor.completed).toBe(true);
      expectProcesses([rootPid, runnerPid]).toBeDead();
      expect(() => process.kill(-rootPid, 0)).toThrow(expect.objectContaining({ code: "ESRCH" }));
    });

    it("allows terminate to interrupt an escalating stop", async ({ onTestFinished }) => {
      await expectTerminateInterruptsPendingStop({ escalate: true, escalationTimeout: 30_000 }, onTestFinished);
    });

    it("allows terminate to interrupt a non-escalating stop", async ({ onTestFinished }) => {
      await expectTerminateInterruptsPendingStop({ escalate: false }, onTestFinished);
    });

    it("reuses one graceful stop operation for repeated calls", async ({ onTestFinished }) => {
      const fixture = await SupervisorFixture.create();
      const treeScriptPath = fixture.resolvePath("three-level-tree.mjs");
      const supervisor = new PosixProcessSupervisor(process.execPath, {
        arguments: [treeScriptPath, "0", fixture.workingDirectory, "graceful-stop"],
        silent: true,
      });

      onTestFinished(() => fixture.cleanup({ supervisor }));

      await fixture.writeScript("three-level-tree.mjs", nodeScripts.threeLevelTree);

      await supervisor.start();

      const rootPid = supervisor.process.pid!;
      const processIds = await Promise.all([0, 1, 2].map((level) => fixture.readProcessId(`level-${level}.pid`)));
      const killMock = vi.spyOn(process, "kill");

      try {
        const firstStop = supervisor.stop();
        const secondStop = supervisor.stop();

        expect(secondStop).toBe(firstStop);

        await firstStop;

        expect(supervisor.stop()).toBe(firstStop);
        expect(killMock.mock.calls.filter(([pid, signal]) => pid === -rootPid && signal === "SIGINT")).toHaveLength(1);
        const signalledProcessIds = await Promise.all(
          [0, 1, 2].map((level) => fixture.readProcessId(`level-${level}.sigint`)),
        );

        expect(signalledProcessIds).toEqual(processIds);
        await expect(supervisor.completion).resolves.toEqual({ code: 20, signal: null });
        expect(supervisor.completed).toBe(true);
        expectProcesses(processIds).toBeDead();
      } finally {
        killMock.mockRestore();
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

      await supervisor.start();

      const rootPid = supervisor.process.pid!;
      const processIds = await Promise.all([0, 1, 2].map((level) => fixture.readProcessId(`level-${level}.pid`)));
      const supervisorSigintListeners = process
        .listeners("SIGINT")
        .filter((listener) => !existingSigintListeners.has(listener));

      expect(supervisorSigintListeners).toHaveLength(1);
      expectProcesses(processIds).toBeAlive();
      expect(supervisor.completed).toBe(false);

      supervisorSigintListeners[0]!("SIGINT");

      await expect(supervisor.completion).resolves.toEqual({ code: 20, signal: null, externalInterruption: "stopped" });

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

      await supervisor.start();

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

      await expect(supervisor.completion).resolves.toEqual({
        code: null,
        signal: "SIGKILL",
        externalInterruption: "terminated",
      });

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

      await supervisor.start();

      const rootPid = supervisor.process.pid!;
      const processIds = await Promise.all([0, 1, 2].map((level) => fixture.readProcessId(`level-${level}.pid`)));
      const supervisorSigtermListeners = process
        .listeners("SIGTERM")
        .filter((listener) => !existingSigtermListeners.has(listener));
      const realKill = process.kill.bind(process);
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
        expect(process.listeners("SIGTERM")).not.toContain(supervisorSigtermListeners[0]);
      } finally {
        killMock.mockRestore();
      }
    });
  });
});

import { mkdtemp, rm } from "node:fs/promises";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

import { attachment, epic, feature, label, step, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SupervisedCommandOptions } from "../../../dist/utils/supervisor/model.js";
import { WindowsProcessSupervisor } from "../../../dist/utils/supervisor/windows/WindowsProcessSupervisor.js";
import { nodeScripts } from "./posix.scripts.js";
import { SupervisorFixture, expectProcesses } from "./supervisor.helpers.js";

const createTempDir = async () => {
  return await mkdtemp(join(tmpdir(), "win-supervisor-test-"));
};

const superviseNodeScript = (script: string, options: SupervisedCommandOptions = {}) => {
  return new WindowsProcessSupervisor(process.execPath, {
    silent: true,
    ...options,
    arguments: ["--eval", script, ...(options.arguments ?? [])],
  });
};

const start = async (supervisor: WindowsProcessSupervisor) => {
  await step("Launch the target process", async (ctx) => {
    await supervisor.start();

    await ctx.parameter("Host PID", String(supervisor.process.pid));
    await ctx.parameter("Target PID", String(supervisor.startupInfo.pid));

    expect(supervisor.started).toBe(true);
    expect(supervisor.startupInfo.pid).toBeGreaterThan(0);
    expect(supervisor.startupInfo.pid).not.toBe(supervisor.process.pid);
  });
};

const wait = async (supervisor: WindowsProcessSupervisor) => {
  return await step("Wait for supervisor completion", async (ctx) => {
    const completion = await supervisor.completion;
    expect(supervisor.completed).toBe(true);
    await ctx.parameter("Result", String(completion.code ?? completion.signal));
    const stdout = await supervisor.stdout;
    const stderr = await supervisor.stderr;
    if (stdout) await attachment("Standard output", stdout, "text/plain");
    if (stderr) await attachment("Standard error", stderr, "text/plain");
    return { ...completion, stdout, stderr };
  });
};

const waitProcessGone = async (pid: number) => {
  await vi.waitFor(
    () => {
      try {
        process.kill(pid, 0);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ESRCH") {
          return;
        }
        throw error;
      }
      throw new Error(`PID=${pid} is still alive`);
    },
    { timeout: 2_000 },
  );
};

describe("WindowsProcessSupervisor", { skip: process.platform !== "win32", timeout: 45_000 }, () => {
  beforeEach(async () => {
    await epic("coverage");
    await feature("cli-run");
    await story("windows-process-supervisor");
    await label("coverage", "cli-run");
  });

  it("launches a single process and reports its natural completion", async () => {
    const supervisor = superviseNodeScript(
      'process.stdout.write(String(process.pid)); process.stderr.write("single process stderr");',
    );

    await start(supervisor);
    const { code, signal, stdout, stderr } = await wait(supervisor);

    await step("Observe successful natural completion and captured output", async () => {
      expect(code).toEqual(0);
      expect(signal).toBeNull();
      expect(stdout).toBe(String(supervisor.startupInfo.pid));
      expect(stderr).toBe("single process stderr");
    });
  });

  it("reports a zero exit code of a single process", async () => {
    const supervisor = superviseNodeScript("process.exitCode = 0;");

    await start(supervisor);
    const { code, signal } = await wait(supervisor);

    await step("Observe successful natural completion and captured output", async () => {
      expect(code).toEqual(0);
      expect(signal).toBeNull();
    });
  });

  it("waits for a descendant after the root exits and preserves the root exit code", async ({ onTestFinished }) => {
    const fixture = await SupervisorFixture.create();
    const supervisor = new WindowsProcessSupervisor(process.execPath, {
      arguments: [
        fixture.resolvePath("root.mjs"),
        fixture.resolvePath("descendant.mjs"),
        fixture.resolvePath("descendant-ready"),
        fixture.resolvePath("descendant-release"),
        "detached",
      ],
      silent: true,
    });

    // Release the child even if an assertion fails; it also has its own exit deadline.
    onTestFinished(() =>
      fixture.cleanup({
        beforeTerminate: async () => {
          await fixture.touchFile("descendant-release");
          if (supervisor.started) {
            await supervisor.completion;
          }
        },
      }),
    );

    await fixture.writeScript("descendant.mjs", nodeScripts.descendant);
    await fixture.writeScript("root.mjs", `${nodeScripts.rootWithDescendant}\nprocess.exitCode = 23;`);
    await start(supervisor);

    const rootPid = supervisor.startupInfo.pid;
    const descendantPid = await fixture.readProcessId("descendant-ready");

    await step("Verify the root has exited while its descendant keeps the job alive", async () => {
      await attachment("Process tree", JSON.stringify({ rootPid, descendantPid }), "application/json");
      await waitProcessGone(rootPid);
      expectProcesses([rootPid]).toBeDead();
      expectProcesses([descendantPid]).toBeAlive();
      await expect(Promise.race([supervisor.completion.then(() => "completed"), delay(50, "pending")])).resolves.toBe(
        "pending",
      );
      expect(supervisor.completed).toBe(false);
    });

    await step("Release the descendant and verify the root exit code is preserved", async () => {
      await fixture.touchFile("descendant-release");
      const { code, signal, stdout, stderr } = await wait(supervisor);
      expect(code).toBe(23);
      expect(signal).toBeNull();
      expect(stdout).toBe("");
      expect(stderr).toBe("");
      expectProcesses([rootPid, descendantPid]).toBeDead();
    });
  });

  it("forcibly terminates a single running process", async ({ onTestFinished }) => {
    const fixture = await SupervisorFixture.create();
    const supervisor = new WindowsProcessSupervisor(process.execPath, {
      arguments: [fixture.resolvePath("target.mjs"), fixture.resolvePath("target-ready")],
      silent: true,
    });

    onTestFinished(() =>
      fixture.cleanup({
        beforeTerminate: async () => {
          if (supervisor.started && !supervisor.completed) {
            await supervisor.terminate();
          }
        },
      }),
    );

    await fixture.writeScript(
      "target.mjs",
      `
        import { rename, writeFile } from "node:fs/promises";

        setTimeout(() => process.exit(42), 30_000);
        const readyPath = process.argv[2];
        const temporaryPath = readyPath + ".tmp";
        await writeFile(temporaryPath, String(process.pid), "utf-8");
        await rename(temporaryPath, readyPath);
      `,
    );
    await start(supervisor);

    const targetPid = await fixture.readProcessId("target-ready");
    const hostPid = supervisor.process.pid!;

    await step("Verify the single target is ready and still running", async () => {
      expect(targetPid).toBe(supervisor.startupInfo.pid);
      expectProcesses([targetPid, hostPid]).toBeAlive();
      expect(supervisor.completed).toBe(false);
      await attachment("Processes before termination", JSON.stringify({ targetPid, hostPid }), "application/json");
    });

    await step("Force termination and verify both target and host have exited", async () => {
      await supervisor.terminate();
      const { code, signal, stdout, stderr } = await wait(supervisor);

      expect(code).toBe(1);
      expect(signal).toBeNull();
      expect(stdout).toBe("");
      expect(stderr).toBe("");
      await waitProcessGone(targetPid);
      await waitProcessGone(hostPid);
      expectProcesses([targetPid, hostPid]).toBeDead();
      expect(supervisor.process.exitCode).toBe(0);
      expect(supervisor.process.signalCode).toBeNull();
    });
  }, 10_000);

  it("rejects completion and cleans up when the process host dies unexpectedly", async ({ onTestFinished }) => {
    const fixture = await SupervisorFixture.create();
    const listenersBefore = process.rawListeners("SIGINT");
    const supervisor = new WindowsProcessSupervisor(process.execPath, {
      arguments: [fixture.resolvePath("target.mjs"), fixture.resolvePath("target-ready")],
      silent: true,
    });

    onTestFinished(() =>
      fixture.cleanup({
        beforeTerminate: async () => {
          if (supervisor.started) {
            const host = supervisor.process;
            if (host.exitCode === null && host.signalCode === null) {
              host.kill("SIGKILL");
            }
            // Host death deliberately rejects completion; the test checks that error below.
            await supervisor.completion.catch(() => {});
          }
        },
      }),
    );

    await fixture.writeScript(
      "target.mjs",
      `
      import { rename, writeFile } from "node:fs/promises";

      setTimeout(() => process.exit(42), 30_000);
      const readyPath = process.argv[2];
      const temporaryPath = readyPath + ".tmp";
      await writeFile(temporaryPath, String(process.pid), "utf-8");
      await rename(temporaryPath, readyPath);
    `,
    );
    await start(supervisor);
    const targetPid = await fixture.readProcessId("target-ready");
    const hostPid = supervisor.process.pid!;
    const pipePath = `\\\\.\\pipe\\${supervisor.process.spawnargs[2]}`;

    await step("Kill the live host and verify completion rejects", async () => {
      expect(targetPid).toBe(supervisor.startupInfo.pid);
      expectProcesses([targetPid, hostPid]).toBeAlive();
      const completionError = supervisor.completion.then(
        () => undefined,
        (error: unknown) => error,
      );
      expect(supervisor.process.kill("SIGKILL")).toBe(true);
      expect(await completionError).toEqual(
        expect.objectContaining({ message: "Control connection closed before startup or completion." }),
      );
    });

    await step("Verify host death removes the target, SIGINT listener, and control pipe", async () => {
      await Promise.all([targetPid, hostPid].map(waitProcessGone));
      expectProcesses([targetPid, hostPid]).toBeDead();
      expect(supervisor.process.signalCode).toBe("SIGKILL");
      expect(process.rawListeners("SIGINT")).toEqual(listenersBefore);
      const connectionError = await new Promise<Error>((resolve, reject) => {
        const socket = createConnection(pipePath);
        socket.setTimeout(1_000, () => {
          socket.destroy();
          reject(new Error("Timed out checking control pipe cleanup."));
        });
        socket.once("connect", () => {
          socket.destroy();
          reject(new Error("The control pipe is still accepting connections."));
        });
        socket.once("error", resolve);
      });
      expect(connectionError).toMatchObject({ code: "ENOENT" });
    });
  }, 10_000);

  it("reuses one termination promise for repeated calls", async ({ onTestFinished }) => {
    const fixture = await SupervisorFixture.create();
    const supervisor = new WindowsProcessSupervisor(process.execPath, {
      arguments: [fixture.resolvePath("target.mjs"), fixture.resolvePath("target-ready")],
      silent: true,
    });

    onTestFinished(() =>
      fixture.cleanup({
        beforeTerminate: async () => {
          if (supervisor.started && !supervisor.completed) {
            await supervisor.terminate();
          }
        },
      }),
    );

    await fixture.writeScript(
      "target.mjs",
      `
        import { rename, writeFile } from "node:fs/promises";

        setTimeout(() => process.exit(42), 30_000);
        const readyPath = process.argv[2];
        const temporaryPath = readyPath + ".tmp";
        await writeFile(temporaryPath, String(process.pid), "utf-8");
        await rename(temporaryPath, readyPath);
      `,
    );
    await start(supervisor);

    const targetPid = await fixture.readProcessId("target-ready");
    const hostPid = supervisor.process.pid!;

    await step("Verify the target is ready before repeated termination calls", async () => {
      expect(targetPid).toBe(supervisor.startupInfo.pid);
      expectProcesses([targetPid, hostPid]).toBeAlive();
      expect(supervisor.completed).toBe(false);
    });

    await step("Verify repeated terminate calls share one successful promise", async () => {
      const first = supervisor.terminate();
      const second = supervisor.terminate();
      await Promise.all([first, second]);
      expect(second).toBe(first);
      const { code, signal, stdout, stderr } = await wait(supervisor);
      expect(code).toBe(1);
      expect(signal).toBeNull();
      expect(stdout).toBe("");
      expect(stderr).toBe("");
      await Promise.all([targetPid, hostPid].map(waitProcessGone));
      expectProcesses([targetPid, hostPid]).toBeDead();
      expect(supervisor.process.exitCode).toBe(0);
      expect(supervisor.process.signalCode).toBeNull();
    });
  }, 10_000);

  it("reuses one graceful stop promise for repeated calls", async ({ onTestFinished }) => {
    const fixture = await SupervisorFixture.create();
    const supervisor = new WindowsProcessSupervisor(process.execPath, {
      arguments: [
        fixture.resolvePath("target.mjs"),
        fixture.resolvePath("target-ready"),
        fixture.resolvePath("sigint"),
      ],
      silent: true,
      stopTimeout: 3_000,
    });

    onTestFinished(() =>
      fixture.cleanup({
        beforeTerminate: async () => {
          if (supervisor.started && !supervisor.completed) {
            await supervisor.terminate();
          }
        },
      }),
    );

    await fixture.writeScript(
      "target.mjs",
      `
        import { rename, writeFile } from "node:fs/promises";

        const [readyPath, acknowledgmentPath] = process.argv.slice(2);
        setTimeout(() => process.exit(42), 30_000);
        process.once("SIGINT", async () => {
          await writeFile(acknowledgmentPath, String(process.pid), "utf-8");
          process.exit(20);
        });
        const temporaryPath = readyPath + ".tmp";
        await writeFile(temporaryPath, String(process.pid), "utf-8");
        await rename(temporaryPath, readyPath);
      `,
    );
    await start(supervisor);

    const targetPid = await fixture.readProcessId("target-ready");
    const hostPid = supervisor.process.pid!;

    await step("Verify the cooperative target is ready before repeated stop calls", async () => {
      expect(targetPid).toBe(supervisor.startupInfo.pid);
      expectProcesses([targetPid, hostPid]).toBeAlive();
      expect(supervisor.completed).toBe(false);
    });

    await step("Verify repeated stop calls share one successful graceful stop promise", async () => {
      const first = supervisor.stop();
      const second = supervisor.stop();
      await Promise.all([first, second]);
      expect(second).toBe(first);
      const { code, signal, stdout, stderr } = await wait(supervisor);
      expect(await fixture.readProcessId("sigint")).toBe(targetPid);
      expect(code).toBe(20);
      expect(signal).toBeNull();
      expect(stdout).toBe("");
      expect(stderr).toBe("");
      await Promise.all([targetPid, hostPid].map(waitProcessGone));
      expectProcesses([targetPid, hostPid]).toBeDead();
      expect(supervisor.process.exitCode).toBe(0);
      expect(supervisor.process.signalCode).toBeNull();
    });
  }, 10_000);

  it("forcibly terminates while graceful stop is pending", async ({ onTestFinished }) => {
    const fixture = await SupervisorFixture.create();
    const supervisor = new WindowsProcessSupervisor(process.execPath, {
      arguments: [
        fixture.resolvePath("target.mjs"),
        fixture.resolvePath("target-ready"),
        fixture.resolvePath("sigint"),
      ],
      silent: true,
      stopTimeout: 30_000,
    });

    onTestFinished(() =>
      fixture.cleanup({
        beforeTerminate: async () => {
          if (supervisor.started && !supervisor.completed) {
            await supervisor.terminate();
          }
        },
      }),
    );

    await fixture.writeScript(
      "target.mjs",
      `
      import { rename, writeFile } from "node:fs/promises";

      const [readyPath, acknowledgmentPath] = process.argv.slice(2);
      setTimeout(() => process.exit(42), 30_000);
      process.once("SIGINT", async () => {
        const temporaryPath = acknowledgmentPath + ".tmp";
        await writeFile(temporaryPath, String(process.pid), "utf-8");
        await rename(temporaryPath, acknowledgmentPath);
      });
      const temporaryPath = readyPath + ".tmp";
      await writeFile(temporaryPath, String(process.pid), "utf-8");
      await rename(temporaryPath, readyPath);
    `,
    );
    await start(supervisor);

    const targetPid = await fixture.readProcessId("target-ready");
    const hostPid = supervisor.process.pid!;
    expect(targetPid).toBe(supervisor.startupInfo.pid);
    const stopping = supervisor.stop();
    // Observe rejection during acknowledgment checks; retain the original promise.
    void stopping.catch(() => {});

    await step("Verify graceful stop is pending after the target acknowledges SIGINT", async () => {
      expect(await fixture.readProcessId("sigint")).toBe(targetPid);
      expectProcesses([targetPid, hostPid]).toBeAlive();
      expect(supervisor.completed).toBe(false);
      await expect(Promise.race([stopping.then(() => "stopped"), delay(50, "pending")])).resolves.toBe("pending");
    });

    await step("Force termination and verify both shutdown promises resolve", async () => {
      const terminating = supervisor.terminate();
      await Promise.all([stopping, terminating]);
      const { code, signal, stdout, stderr } = await wait(supervisor);
      expect(code).toBe(1);
      expect(signal).toBeNull();
      expect(stdout).toBe("");
      expect(stderr).toBe("");
      await Promise.all([targetPid, hostPid].map(waitProcessGone));
      expectProcesses([targetPid, hostPid]).toBeDead();
      expect(supervisor.process.exitCode).toBe(0);
      expect(supervisor.process.signalCode).toBeNull();
    });
  }, 10_000);

  it("gracefully stops a single cooperative process", async ({ onTestFinished }) => {
    const fixture = await SupervisorFixture.create();
    const supervisor = new WindowsProcessSupervisor(process.execPath, {
      arguments: [
        fixture.resolvePath("target.mjs"),
        fixture.resolvePath("target-ready"),
        fixture.resolvePath("sigint"),
      ],
      silent: true,
      stopTimeout: 3_000,
    });

    onTestFinished(() =>
      fixture.cleanup({
        beforeTerminate: async () => {
          if (supervisor.started && !supervisor.completed) {
            await supervisor.terminate();
          }
        },
      }),
    );

    await fixture.writeScript(
      "target.mjs",
      `
        import { rename, writeFile } from "node:fs/promises";

        const [readyPath, acknowledgmentPath] = process.argv.slice(2);
        setTimeout(() => process.exit(42), 30_000);
        process.once("SIGINT", async () => {
          await writeFile(acknowledgmentPath, String(process.pid), "utf-8");
          process.exit(20);
        });
        const temporaryPath = readyPath + ".tmp";
        await writeFile(temporaryPath, String(process.pid), "utf-8");
        await rename(temporaryPath, readyPath);
      `,
    );
    await start(supervisor);

    const targetPid = await fixture.readProcessId("target-ready");
    const hostPid = supervisor.process.pid!;

    await step("Verify the cooperative target is ready to receive SIGINT", async () => {
      expect(targetPid).toBe(supervisor.startupInfo.pid);
      expectProcesses([targetPid, hostPid]).toBeAlive();
      expect(supervisor.completed).toBe(false);
    });

    await step("Gracefully stop and verify SIGINT acknowledgment and exit code 20", async () => {
      await supervisor.stop();
      const { code, signal, stdout, stderr } = await wait(supervisor);
      expect(await fixture.readProcessId("sigint")).toBe(targetPid);
      expect(code).toBe(20);
      expect(signal).toBeNull();
      expect(stdout).toBe("");
      expect(stderr).toBe("");
      await Promise.all([targetPid, hostPid].map(waitProcessGone));
      expectProcesses([targetPid, hostPid]).toBeDead();
      expect(supervisor.process.exitCode).toBe(0);
      expect(supervisor.process.signalCode).toBeNull();
    });
  }, 10_000);

  it("escalates graceful stop to forced termination when the target ignores SIGINT", async ({ onTestFinished }) => {
    const fixture = await SupervisorFixture.create();
    const supervisor = new WindowsProcessSupervisor(process.execPath, {
      arguments: [
        fixture.resolvePath("target.mjs"),
        fixture.resolvePath("target-ready"),
        fixture.resolvePath("sigint"),
      ],
      silent: true,
      stopTimeout: 500,
    });

    onTestFinished(() =>
      fixture.cleanup({
        beforeTerminate: async () => {
          if (supervisor.started && !supervisor.completed) {
            await supervisor.terminate();
          }
        },
      }),
    );

    await fixture.writeScript(
      "target.mjs",
      `
        import { rename, writeFile } from "node:fs/promises";

        const [readyPath, acknowledgmentPath] = process.argv.slice(2);
        setTimeout(() => process.exit(42), 30_000);
        process.once("SIGINT", async () => {});
        const temporaryPath = readyPath + ".tmp";
        await writeFile(temporaryPath, String(process.pid), "utf-8");
        await rename(temporaryPath, readyPath);
      `,
    );
    await start(supervisor);

    const targetPid = await fixture.readProcessId("target-ready");
    const hostPid = supervisor.process.pid!;

    await step("Verify the target is ready before requesting graceful stop", async () => {
      expect(targetPid).toBe(supervisor.startupInfo.pid);
      expectProcesses([targetPid, hostPid]).toBeAlive();
    });

    await step("Waiting for the escalated stop", async () => {
      await supervisor.stop();
    });

    await step("Verify the stop timeout forces termination of target and host", async () => {
      const { code, signal, stdout, stderr } = await wait(supervisor);
      expect(code).toBe(1);
      expect(signal).toBeNull();
      expect(stdout).toBe("");
      expect(stderr).toBe("");
      await Promise.all([targetPid, hostPid].map(waitProcessGone));
      expectProcesses([targetPid, hostPid]).toBeDead();
      expect(supervisor.process.exitCode).toBe(0);
      expect(supervisor.process.signalCode).toBeNull();
    });
  }, 10_000);

  it("gracefully stops a three-level process tree", async ({ onTestFinished }) => {
    const fixture = await SupervisorFixture.create();
    const supervisor = new WindowsProcessSupervisor(process.execPath, {
      arguments: [fixture.resolvePath("tree.mjs"), "0", fixture.workingDirectory, "exit"],
      silent: true,
      stopTimeout: 3_000,
    });

    onTestFinished(() =>
      fixture.cleanup({
        beforeTerminate: async () => {
          if (supervisor.started && !supervisor.completed) {
            await supervisor.terminate();
          }
        },
      }),
    );

    await fixture.writeScript("tree.mjs", nodeScripts.threeLevelTree);
    await start(supervisor);

    const processIds = await Promise.all([0, 1, 2].map((level) => fixture.readProcessId(`level-${level}.pid`)));
    const hostPid = supervisor.process.pid!;

    await step("Verify all three processes are ready to receive SIGINT", async () => {
      expect(processIds[0]).toBe(supervisor.startupInfo.pid);
      expect(new Set([...processIds, hostPid]).size).toBe(4);
      expectProcesses([...processIds, hostPid]).toBeAlive();
      expect(supervisor.completed).toBe(false);
    });

    await step("Gracefully stop the tree and verify every SIGINT acknowledgment", async () => {
      await supervisor.stop();
      const { code, signal, stdout, stderr } = await wait(supervisor);
      const acknowledgments = await Promise.all(
        [0, 1, 2].map((level) => fixture.readProcessId(`level-${level}.sigint`)),
      );

      expect(acknowledgments).toEqual(processIds);
      expect(code).toBe(20);
      expect(signal).toBeNull();
      expect(stdout).toBe("");
      expect(stderr).toBe("");
      await Promise.all([...processIds, hostPid].map(waitProcessGone));
      expectProcesses([...processIds, hostPid]).toBeDead();
      expect(supervisor.process.exitCode).toBe(0);
      expect(supervisor.process.signalCode).toBeNull();
    });
  }, 10_000);

  it("escalates graceful stop to forced termination of a three-level process tree", async ({ onTestFinished }) => {
    const fixture = await SupervisorFixture.create();
    const supervisor = new WindowsProcessSupervisor(process.execPath, {
      arguments: [fixture.resolvePath("tree.mjs"), "0", fixture.workingDirectory, "ignore"],
      silent: true,
      stopTimeout: 500,
    });

    onTestFinished(() =>
      fixture.cleanup({
        beforeTerminate: async () => {
          if (supervisor.started && !supervisor.completed) {
            await supervisor.terminate();
          }
        },
      }),
    );

    await fixture.writeScript("tree.mjs", nodeScripts.threeLevelTree);
    await start(supervisor);

    const processIds = await Promise.all([0, 1, 2].map((level) => fixture.readProcessId(`level-${level}.pid`)));
    const hostPid = supervisor.process.pid!;

    await step("Verify all three processes are ready before requesting graceful stop", async () => {
      expect(processIds[0]).toBe(supervisor.startupInfo.pid);
      expect(new Set([...processIds, hostPid]).size).toBe(4);
      expectProcesses([...processIds, hostPid]).toBeAlive();
      expect(supervisor.completed).toBe(false);
    });

    await supervisor.stop();

    await step("Verify stop timeout escalation removes the entire tree and host", async () => {
      const { code, signal, stdout, stderr } = await wait(supervisor);
      expect(code).toBe(1);
      expect(signal).toBeNull();
      expect(stdout).toBe("");
      expect(stderr).toBe("");
      await Promise.all([...processIds, hostPid].map(waitProcessGone));
      expectProcesses([...processIds, hostPid]).toBeDead();
      expect(supervisor.process.exitCode).toBe(0);
      expect(supervisor.process.signalCode).toBeNull();
    });
  }, 10_000);

  it("forcibly terminates a three-level process tree", async ({ onTestFinished }) => {
    const fixture = await SupervisorFixture.create();
    const supervisor = new WindowsProcessSupervisor(process.execPath, {
      arguments: [fixture.resolvePath("tree.mjs"), "0", fixture.workingDirectory],
      silent: true,
    });

    onTestFinished(() =>
      fixture.cleanup({
        beforeTerminate: async () => {
          if (supervisor.started && !supervisor.completed) {
            await supervisor.terminate();
          }
        },
      }),
    );

    await fixture.writeScript("tree.mjs", nodeScripts.threeLevelTree);
    await start(supervisor);

    const processIds = await Promise.all([0, 1, 2].map((level) => fixture.readProcessId(`level-${level}.pid`)));
    const hostPid = supervisor.process.pid!;

    await step("Verify root, child, and grandchild are ready and alive", async () => {
      expect(processIds[0]).toBe(supervisor.startupInfo.pid);
      expect(new Set([...processIds, hostPid]).size).toBe(4);
      expectProcesses([...processIds, hostPid]).toBeAlive();
      expect(supervisor.completed).toBe(false);
      await attachment(
        "Process tree before termination",
        JSON.stringify({ rootPid: processIds[0], childPid: processIds[1], grandchildPid: processIds[2], hostPid }),
        "application/json",
      );
    });

    await step("Force termination and verify the entire tree and host have exited", async () => {
      await supervisor.terminate();
      const { code, signal, stdout, stderr } = await wait(supervisor);
      expect(code).toBe(1);
      expect(signal).toBeNull();
      expect(stdout).toBe("");
      expect(stderr).toBe("");
      await Promise.all([...processIds, hostPid].map(waitProcessGone));
      expectProcesses([...processIds, hostPid]).toBeDead();
      expect(supervisor.process.exitCode).toBe(0);
      expect(supervisor.process.signalCode).toBeNull();
    });
  }, 10_000);

  it("reports a non-zero exit code of a single process", async () => {
    const supervisor = superviseNodeScript("process.exitCode = 42;");

    await start(supervisor);
    const { code, signal } = await wait(supervisor);

    await step("Observe successful natural completion and captured output", async () => {
      expect(code).toEqual(42);
      expect(signal).toBeNull();
    });
  });

  it("rejects a non-existing executable", async () => {
    const nonExistingExecutable = "0ce2cecd-150b-4266-b843-2062c4e5b9b0";
    const supervisor = new WindowsProcessSupervisor(nonExistingExecutable);

    const listenersBefore = process.rawListeners("SIGINT");
    await expect(supervisor.start()).rejects.toThrow("Command not found: 0ce2cecd-150b-4266-b843-2062c4e5b9b0");
    const listenersAfter = process.rawListeners("SIGINT");

    // Ensure the host exited.
    await expect(supervisor.completion).rejects.toThrow("Command not found: 0ce2cecd-150b-4266-b843-2062c4e5b9b0");

    expect(listenersAfter).toEqual(listenersBefore);
    expect(supervisor.process.exitCode).toBeNull();
    expect(supervisor.process.signalCode).toBe("SIGKILL");
  }, 10_000); // startup timeout is 30s

  it("forwards the arguments to the target", async () => {
    const args = [
      "foo",
      "hello world",
      "",
      'hello "world"',
      "สวัสดี",
      'before\\"after',
      'before\\\\"after',
      "C:\\folder with spaces\\",
    ];
    const supervisor = superviseNodeScript("console.log(JSON.stringify(process.argv.slice(1)));", {
      arguments: args,
    });

    await start(supervisor);
    const { code, signal, stdout, stderr } = await wait(supervisor);

    await step("Observe the arguments received by the target", async () => {
      expect(code).toEqual(0);
      expect(signal).toBeNull();
      expect(JSON.parse(stdout)).toEqual(args);
      expect(stderr).toBe("");
    });
  });

  it("forwards the working directory", async ({ onTestFinished }) => {
    const workingDirectory = await createTempDir();
    onTestFinished(async () => {
      await rm(workingDirectory, { recursive: true, force: true });
    });

    const supervisor = superviseNodeScript("console.log(process.cwd());", {
      workingDirectory,
    });

    await start(supervisor);
    const { code, signal, stdout, stderr } = await wait(supervisor);

    await step("Observe the CWD received by the target", async () => {
      expect(code).toEqual(0);
      expect(signal).toBeNull();
      expect(stdout).toEqual(workingDirectory + "\n");
      expect(stderr).toBe("");
    });
  });

  it("forwards the environment variables", async () => {
    const supervisor = superviseNodeScript("console.log(JSON.stringify(process.env));", {
      environmentVariables: { foo: "hello สวัสดี" },
    });

    await start(supervisor);
    const { code, signal, stdout, stderr } = await wait(supervisor);

    const env = JSON.parse(stdout);

    await step("Observe the environment variables received by the target", async () => {
      expect(code).toEqual(0);
      expect(signal).toBeNull();
      expect(env.foo).toEqual("hello สวัสดี");
      expect(env).toEqual(expect.objectContaining(process.env));
      expect(stderr).toBe("");
    });
  });

  it("ignores stop and terminate after completion", async () => {
    const supervisor = superviseNodeScript("process.exit(23);");

    await start(supervisor);
    const { code, signal } = await supervisor.completion;

    await supervisor.stop();
    await supervisor.terminate();

    await step("Observe the environment variables received by the target", async () => {
      expect(code).toEqual(23);
      expect(signal).toBeNull();
    });
  });
});

import { mkdtemp, rm } from "node:fs/promises";
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
});

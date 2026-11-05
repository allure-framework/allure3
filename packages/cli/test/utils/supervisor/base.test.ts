import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { PassThrough, Writable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";

import { epic, feature, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vite-plus/test";

import type { JobMonitor, ProcessCompletion, SupervisedCommandOptions } from "../../../src/utils/supervisor/model.js";
import { ProcessSupervisorBase } from "../../../src/utils/supervisor/ProcessSupervisorBase.js";
import { relayOutputStream } from "../../../src/utils/supervisor/relays.js";
import { SupervisorFixture, expectProcesses } from "./supervisor.helpers.js";
import { nodeScripts } from "./supervisor.scripts.js";

class TestProcessSupervisor extends ProcessSupervisorBase {
  protected readonly shell = false;
  protected readonly detached = false;
  protected readonly monitor: JobMonitor;

  readonly requestGracefulStop = vi.fn();
  readonly requestForcedTermination = vi.fn();

  constructor(options: SupervisedCommandOptions = {}, monitor: JobMonitor = { wait: async () => undefined }) {
    super(process.execPath, { arguments: ["-e", ""], outputMode: "ignore", ...options });
    this.monitor = monitor;
  }

  protected getStartupInfo() {
    const pid = this.process.pid;
    return pid === undefined ? undefined : { pid };
  }
}

describe("Process supervisor completion", () => {
  const expectPending = (promise: Promise<unknown>) =>
    expect(Promise.race([promise.then(() => "completed"), delay(50, "pending")])).resolves.toBe("pending");

  const startWithInheritedOutput = async (monitor: JobMonitor, releaseMonitor = () => {}) => {
    const fixture = await SupervisorFixture.create();
    let workerPid: number | undefined;
    const supervisor = new TestProcessSupervisor(
      {
        arguments: [fixture.resolvePath("root.mjs"), fixture.resolvePath("worker.mjs"), fixture.workingDirectory],
        outputMode: "pipe",
        silent: true,
      },
      monitor,
    );

    supervisor.requestForcedTermination.mockImplementation(() => {
      supervisor.process.kill("SIGTERM");
    });
    supervisor.requestGracefulStop.mockImplementation(() => {
      supervisor.process.kill("SIGINT");
    });

    onTestFinished(() =>
      fixture.cleanup({
        beforeTerminate: async () => {
          await fixture.touchFile("worker-release");
          await fixture.touchFile("root-release");
          releaseMonitor();
          if (workerPid !== undefined) {
            await vi.waitFor(() => expectProcesses([workerPid!]).toBeDead(), { timeout: 5_000 });
          }
        },
        supervisor,
      }),
    );
    await fixture.writeScript("root.mjs", nodeScripts.rootWithInheritedOutput);
    await fixture.writeScript("worker.mjs", nodeScripts.descendant);
    await supervisor.start();
    await fixture.readProcessId("root.pid");
    workerPid = await fixture.readProcessId("worker.pid");
    return { fixture, supervisor, workerPid };
  };

  beforeEach(async () => {
    await epic("coverage");
    await feature("cli-run");
    await story("process-supervisor");
  });

  it.each(["stop", "stop with escalation", "terminate"] as const)(
    "%s after completion does not request graceful stop or forced termination",
    async (operation) => {
      const supervisor = new TestProcessSupervisor();
      await supervisor.start();
      await expect(supervisor.completion).resolves.toMatchObject({ code: 0, signal: null });
      expect(supervisor.completed).toBe(true);

      const result =
        operation === "terminate"
          ? supervisor.terminate()
          : operation === "stop with escalation"
            ? supervisor.stop({ escalate: true })
            : supervisor.stop();

      await expect(result).resolves.toBeUndefined();
      expect(supervisor.requestGracefulStop).not.toHaveBeenCalled();
      expect(supervisor.requestForcedTermination).not.toHaveBeenCalled();
    },
  );

  it.each(["running", "exited", "closed"] as const)(
    "terminate bypasses root close with a %s root and still waits for the platform monitor",
    async (rootState) => {
      let finishGroup!: (completion: ProcessCompletion) => void;
      const groupCompletion = new Promise<ProcessCompletion>((resolve) => {
        finishGroup = resolve;
      });
      const monitor = { wait: vi.fn(() => groupCompletion), dispose: vi.fn() };
      const { fixture, supervisor, workerPid } = await startWithInheritedOutput(monitor, () =>
        finishGroup({ code: 71, signal: null }),
      );
      const rootExit = once(supervisor.process, "exit");
      const rootClose = once(supervisor.process, "close");

      if (rootState !== "running") {
        await fixture.touchFile("root-release");
        await rootExit;
      }

      if (rootState === "closed") {
        await fixture.touchFile("worker-release");
        await rootClose;
        await vi.waitFor(() => expect(monitor.wait).toHaveBeenCalledOnce());
      } else {
        expectProcesses([workerPid]).toBeAlive();
        expect(supervisor.process.stdout?.destroyed).toBe(false);
        expect(supervisor.process.stderr?.destroyed).toBe(false);
      }

      await expectPending(supervisor.completion);
      const terminating = supervisor.terminate();
      const [code, signal] = await rootExit;

      await vi.waitFor(() => expect(monitor.wait).toHaveBeenCalledWith({ code, signal }));
      await expectPending(supervisor.completion);
      await expectPending(terminating);
      expect(supervisor.completed).toBe(false);
      expect(monitor.dispose).not.toHaveBeenCalled();

      if (rootState !== "closed") {
        expectProcesses([workerPid]).toBeAlive();
        expect(supervisor.process.stdout?.destroyed).toBe(false);
        expect(supervisor.process.stderr?.destroyed).toBe(false);
      }

      finishGroup({ code: 71, signal: null });

      await expect(
        Promise.race([terminating.then(() => "completed"), delay(1_000, "timeout", { ref: false })]),
      ).resolves.toBe("completed");
      await expect(supervisor.completion).resolves.toMatchObject({ code: 71, signal: null });
      expect(supervisor.completed).toBe(true);
      expect(monitor.wait).toHaveBeenCalledOnce();
      expect(monitor.dispose).toHaveBeenCalledOnce();
      expect(supervisor.process.stdout?.destroyed).toBe(true);
      expect(supervisor.process.stderr?.destroyed).toBe(true);
      if (rootState !== "closed") {
        expectProcesses([workerPid]).toBeAlive();
      }
    },
  );

  it.each(["natural completion", "stop"])("%s still waits for inherited output to close", async (operation) => {
    const monitor = { wait: vi.fn(async () => undefined), dispose: vi.fn() };
    const { fixture, supervisor } = await startWithInheritedOutput(monitor);
    const rootExit = once(supervisor.process, "exit");
    if (operation === "stop") {
      void supervisor.stop();
    } else {
      await fixture.touchFile("root-release");
    }
    const [code, signal] = await rootExit;

    await expectPending(supervisor.completion);
    expect(monitor.wait).not.toHaveBeenCalled();
    expect(supervisor.process.stdout?.destroyed).toBe(false);
    expect(supervisor.process.stderr?.destroyed).toBe(false);

    await fixture.touchFile("worker-release");

    await expect(supervisor.completion).resolves.toMatchObject({ code, signal });
    expect(monitor.wait).toHaveBeenCalledWith({ code, signal });
    expect(monitor.dispose).toHaveBeenCalledOnce();
    expect(supervisor.requestForcedTermination).not.toHaveBeenCalled();
  });

  it("preserves spawn failures when terminate is requested before close", async () => {
    const fixture = await SupervisorFixture.create();
    onTestFinished(() => fixture.cleanup());
    const monitor = { wait: vi.fn(), dispose: vi.fn() };
    const supervisor = new TestProcessSupervisor({ workingDirectory: fixture.resolvePath("missing") }, monitor);
    await supervisor.start();

    const terminating = supervisor.terminate();
    await expect(supervisor.completion).rejects.toMatchObject({ code: "ENOENT" });
    await expect(terminating).rejects.toMatchObject({ code: "ENOENT" });
    expect(monitor.wait).not.toHaveBeenCalled();
    expect(monitor.dispose).toHaveBeenCalledOnce();
  });
});

describe("Process supervisor output", () => {
  it("cancels a pending relay and retains its captured output", async () => {
    const upstream = new PassThrough();
    const downstream = new Writable({ write: (_chunk, _encoding, done) => done() });
    const controller = new AbortController();
    const { relay, resultPromise } = relayOutputStream(upstream, downstream, {
      forward: true,
      signal: controller.signal,
    });

    upstream.write("partial output");
    expect(relay?.captured).toBe("partial output");
    expect(upstream.readableEnded).toBe(false);
    controller.abort();

    await expect(resultPromise).resolves.toEqual({ status: "cancelled", captured: "partial output" });
  });

  it("captures a UTF-8 character split across chunks and forwards its original bytes", async () => {
    const upstream = new PassThrough();
    const forwarded: Buffer[] = [];
    const downstream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        forwarded.push(chunk);
        done();
      },
    });
    const { relay, resultPromise } = relayOutputStream(upstream, downstream, { forward: true });

    upstream.write(Buffer.from([0xe2]));
    expect(relay?.captured).toBe("");
    expect(forwarded).toEqual([Buffer.from([0xe2])]);
    upstream.end(Buffer.from([0x82, 0xac]));

    await expect(resultPromise).resolves.toEqual({ status: "completed", captured: "€" });
    expect(Buffer.concat(forwarded)).toEqual(Buffer.from("€"));
  });

  it("rejects completion on an unexpected output stream error and retains captured output", async () => {
    const supervisor = new TestProcessSupervisor({
      arguments: ["-e", "process.stdout.write('partial output'); setInterval(() => {}, 1000);"],
      outputMode: "pipe",
      silent: true,
    });
    await supervisor.start();
    onTestFinished(() => {
      supervisor.process.kill();
    });
    await vi.waitFor(() => expect(supervisor.stdout).toBe("partial output"));

    const failure = new Error("stdout failed");
    const completion = expect(supervisor.completion).rejects.toBe(failure);
    supervisor.process.stdout!.destroy(failure);
    supervisor.process.kill();

    await completion;
    expect(supervisor.stdout).toBe("partial output");
  });

  it.each([
    {
      outputEncoding: undefined,
      stderrEncoding: undefined,
      stdout: "\uFFFD",
      stderr: "\uFFFD",
      bytes: [0xe9],
      stderrBytes: [0xe9],
    },
    {
      outputEncoding: "latin1",
      stderrEncoding: undefined,
      stdout: "é",
      stderr: "é",
      bytes: [0xc3, 0xa9],
      stderrBytes: [0xc3, 0xa9],
    },
    {
      outputEncoding: "latin1",
      stderrEncoding: "ascii",
      stdout: "é",
      stderr: "i",
      bytes: [0xc3, 0xa9],
      stderrBytes: [0x69],
    },
  ] as const)("captures and forwards output with $outputEncoding / $stderrEncoding", async (scenario) => {
    const stdoutWrite = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const stderrWrite = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    onTestFinished(() => {
      stdoutWrite.mockRestore();
      stderrWrite.mockRestore();
    });
    const supervisor = new TestProcessSupervisor({
      arguments: ["-e", "process.stdout.write(Buffer.from([233])); process.stderr.write(Buffer.from([233]));"],
      outputMode: "pipe",
      outputEncoding: scenario.outputEncoding,
      stderrEncoding: scenario.stderrEncoding,
    });

    await supervisor.start();
    await expect(supervisor.exitCode).resolves.toBe(0);
    expect(supervisor.stdout).toBe(scenario.stdout);
    expect(supervisor.stderr).toBe(scenario.stderr);
    expect(stdoutWrite).toHaveBeenCalledWith(Buffer.from(scenario.bytes));
    expect(stderrWrite).toHaveBeenCalledWith(Buffer.from(scenario.stderrBytes));
    expect(process.stdout.writableEnded).toBe(false);
    expect(process.stderr.writableEnded).toBe(false);
  });

  it("exposes captured output while the child is still running and retains it after termination", async () => {
    const supervisor = new TestProcessSupervisor({
      arguments: [
        "-e",
        "process.stdout.write('live stdout'); process.stderr.write('live stderr'); setInterval(() => {}, 1000);",
      ],
      outputMode: "pipe",
      silent: true,
    });
    supervisor.requestForcedTermination.mockImplementation(() => supervisor.process.kill());
    await supervisor.start();
    onTestFinished(() => supervisor.terminate());

    await vi.waitFor(() => {
      expect(supervisor.stdout).toBe("live stdout");
      expect(supervisor.stderr).toBe("live stderr");
    });
    expect(supervisor.completed).toBe(false);

    await supervisor.terminate();
    expect(supervisor.completed).toBe(true);
    expect(supervisor.stdout).toBe("live stdout");
    expect(supervisor.stderr).toBe("live stderr");
  });
});

describe("Process supervisor color environment", () => {
  beforeEach(async () => {
    await epic("coverage");
    await feature("cli-run");
    await story("process-supervisor");
    for (const key of ["NO_COLOR", "FORCE_COLOR", "CLICOLOR_FORCE", "COLOR", "COLORTERM", "TERM"]) {
      vi.stubEnv(key, undefined);
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const readChildEnvironment = async (environmentVariables: Record<string, string> = {}) => {
    const script = `
      process.stdout.write(
        JSON.stringify(
          Object.fromEntries([
            "NO_COLOR",
            "FORCE_COLOR",
            "CLICOLOR_FORCE",
            "COLOR",
            "COLORTERM",
            "TERM",
          ].map(key => [key, process.env[key]])),
        ),
      )`;
    const supervisor = new TestProcessSupervisor({
      arguments: ["-e", script],
      outputMode: "pipe",
      silent: true,
      environmentVariables,
    });
    await supervisor.start();
    await expect(supervisor.completion).resolves.toMatchObject({ code: 0, signal: null });
    return JSON.parse(supervisor.stdout) as Record<string, string>;
  };

  it("adds color defaults for piped output when NO_COLOR is absent", async () => {
    expect(await readChildEnvironment()).toEqual({
      FORCE_COLOR: "1",
      CLICOLOR_FORCE: "1",
      COLOR: "1",
      COLORTERM: "truecolor",
      TERM: "xterm-256color",
    });
  });

  it.each(["inherit", "ignore"] as const)("does not inject color defaults in %s mode", async (outputMode) => {
    const directory = await mkdtemp(join(tmpdir(), "allure-supervisor-color-"));
    const environmentPath = join(directory, "environment.json");
    try {
      const script = `
        const { renameSync, writeFileSync } = require("node:fs");
        const temporaryPath = process.argv[1] + "." + process.pid + ".tmp";
        writeFileSync(
          temporaryPath,
          JSON.stringify(
            Object.fromEntries([
              "NO_COLOR",
              "FORCE_COLOR",
              "CLICOLOR_FORCE",
              "COLOR",
              "COLORTERM",
              "TERM",
            ].map(key => [key, process.env[key]])),
          ),
        );
        renameSync(temporaryPath, process.argv[1]);
      `;
      const supervisor = new TestProcessSupervisor({
        arguments: ["-e", script, environmentPath],
        outputMode,
      });
      await supervisor.start();
      await expect(supervisor.completion).resolves.toMatchObject({ code: 0, signal: null });
      expect(JSON.parse(await readFile(environmentPath, "utf-8"))).toEqual({});
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("should have inherited NO_COLOR suppress injected color defaults", async () => {
    vi.stubEnv("NO_COLOR", "1");
    expect(await readChildEnvironment()).toEqual({
      NO_COLOR: "1",
    });
  });

  it("Should have explicit NO_COLOR suppress injected color defaults", async () => {
    expect(await readChildEnvironment({ NO_COLOR: "1" })).toEqual({
      NO_COLOR: "1",
    });
  });

  it("preserves explicit color settings", async () => {
    const overrides = {
      FORCE_COLOR: "0",
      CLICOLOR_FORCE: "0",
      COLOR: "0",
      COLORTERM: "custom-color",
      TERM: "dumb",
    };
    expect(await readChildEnvironment(overrides)).toEqual(overrides);
  });
});

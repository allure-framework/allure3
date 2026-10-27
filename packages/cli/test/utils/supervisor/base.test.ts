import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

import { epic, feature, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { JobMonitor, SupervisedCommandOptions } from "../../../src/utils/supervisor/model.js";
import { ProcessSupervisorBase } from "../../../src/utils/supervisor/ProcessSupervisorBase.js";

class TestProcessSupervisor extends ProcessSupervisorBase {
  protected readonly shell = false;
  protected readonly detached = false;
  protected readonly monitor: JobMonitor = {
    wait: async () => undefined,
  };

  readonly requestGracefulStop = vi.fn();
  readonly requestForcedTermination = vi.fn();

  constructor(options: SupervisedCommandOptions = {}) {
    super(process.execPath, { arguments: ["-e", ""], outputMode: "ignore", ...options });
  }

  protected getStartupInfo() {
    const pid = this.process.pid;
    return pid === undefined ? undefined : { pid };
  }
}

describe("Process supervisor completion", () => {
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
    return JSON.parse(await supervisor.stdout) as Record<string, string>;
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
        const { writeFileSync } = require("node:fs");
        writeFileSync(
          process.argv[1],
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

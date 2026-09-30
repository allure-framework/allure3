import { lstatSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

import { expect } from "vitest";

import type { PosixProcessSupervisor } from "../../../src/utils/supervisor/index.js";

type SupervisorFixtureCleanupOptions = {
  beforeTerminate?: () => Promise<void> | void;
  supervisor?: PosixProcessSupervisor;
};

const ensureProcessId = (processId: number, description: string) => {
  if (!Number.isSafeInteger(processId) || processId <= 0) {
    throw new Error(`Invalid process ID ${processId} for ${description}`);
  }

  return processId;
};

export class SupervisorFixture {
  private constructor(readonly workingDirectory: string) {}

  static async create() {
    const workingDirectory = await mkdtemp(join(tmpdir(), "allure-posix-supervisor-"));

    return new SupervisorFixture(workingDirectory);
  }

  resolvePath(relativePath: string) {
    return join(this.workingDirectory, relativePath);
  }

  writeScript(relativePath: string, script: string) {
    return writeFile(this.resolvePath(relativePath), script, "utf-8");
  }

  touchFile(relativePath: string) {
    return writeFile(this.resolvePath(relativePath), "", "utf-8");
  }

  fileExists(relativePath: string) {
    try {
      lstatSync(this.resolvePath(relativePath));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }

      throw error;
    }
  }

  async readProcessId(relativePath: string, timeout = 2_000) {
    await this.waitForFile(relativePath, timeout);
    const contents = (await readFile(this.resolvePath(relativePath), "utf-8")).trim();

    if (!/^[1-9]\d*$/.test(contents)) {
      throw new Error(`Invalid process ID contents in ${relativePath}: ${JSON.stringify(contents)}`);
    }

    return ensureProcessId(Number(contents), relativePath);
  }

  async waitForFile(relativePath: string, timeout = 2_000) {
    const deadline = Date.now() + timeout;
    const path = this.resolvePath(relativePath);

    while (Date.now() < deadline) {
      try {
        lstatSync(path);
        return;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }

      await delay(25);
    }

    throw new Error(`Timed out waiting for ${relativePath}`);
  }

  async cleanup({ beforeTerminate, supervisor }: SupervisorFixtureCleanupOptions = {}) {
    const errors: unknown[] = [];
    const runCleanupStep = async (step: () => Promise<void> | void) => {
      try {
        await step();
      } catch (error) {
        errors.push(error);
      }
    };

    if (beforeTerminate) {
      await runCleanupStep(beforeTerminate);
    }

    if (supervisor?.started && !supervisor.completed) {
      await runCleanupStep(() => supervisor.terminate());
    }

    await runCleanupStep(() => rm(this.workingDirectory, { recursive: true, force: true }));

    if (errors.length === 1) {
      throw errors[0];
    }

    if (errors.length > 1) {
      throw new AggregateError(errors, "Multiple errors occurred while cleaning up the supervisor fixture.");
    }
  }
}

export const expectProcesses = (processIds: readonly number[]) => ({
  toBeAlive: () => {
    processIds.forEach((processId) => {
      const pid = ensureProcessId(processId, "process liveness check");

      expect(() => process.kill(pid, 0), `Expected process PID=${pid} to be alive`).not.toThrow();
    });
  },
  toBeDead: () => {
    processIds.forEach((processId) => {
      const pid = ensureProcessId(processId, "process termination check");

      expect(() => process.kill(pid, 0), `Expected process PID=${pid} to be dead`).toThrow(
        expect.objectContaining({ code: "ESRCH" }),
      );
    });
  },
});

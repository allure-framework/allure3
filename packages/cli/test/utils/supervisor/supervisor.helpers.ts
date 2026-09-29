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

export class SupervisorFixture {
  readonly #processIds = new Set<number>();

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
    const processId = Number(await readFile(this.resolvePath(relativePath), "utf-8"));
    this.#processIds.add(processId);
    return processId;
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

    for (const processId of this.#processIds) {
      await runCleanupStep(() => {
        try {
          process.kill(processId, "SIGKILL");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
            throw error;
          }
        }
      });
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
    processIds.forEach((pid) => {
      expect(() => process.kill(pid, 0), `Expected process PID=${pid} to be alive`).not.toThrow();
    });
  },
  toBeDead: () => {
    processIds.forEach((pid) => {
      expect(() => process.kill(pid, 0), `Expected process PID=${pid} to be dead`).toThrow(
        expect.objectContaining({ code: "ESRCH" }),
      );
    });
  },
});

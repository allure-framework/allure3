import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

import { logError } from "../logs.js";
import type { JobMonitor, SupervisedCommandOptions } from "./model.js";
import { ProcessSupervisorBase } from "./ProcessSupervisorBase.js";

const MONITOR_INTERVAL_MS = 100;

export class PosixProcessSupervisor extends ProcessSupervisorBase {
  protected readonly shell: boolean = false;
  protected readonly detached: boolean = true;

  protected readonly monitor: JobMonitor;

  #sigintReceived: boolean = false;

  constructor(command: string, options: SupervisedCommandOptions = {}) {
    super(command, options);
    this.monitor = {
      wait: async () => {
        const pid = this.process.pid;
        if (pid === undefined) {
          throw new Error("The process has not been spawned.");
        }

        while (true) {
          try {
            // Check if the process group is alive.
            process.kill(-pid, 0);
          } catch (error) {
            const { code } = error as NodeJS.ErrnoException;

            if (code === "ESRCH") {
              // The group does not exist: all processes of the group have finished.
              // The root process will define the exit code (or signal).
              return undefined;
            }

            if (code !== "EPERM") {
              throw error;
            }

            // EPERM: the group exists but cannot be signalled.
            // This is fine, continue the polling.
          }

          await delay(MONITOR_INTERVAL_MS);
        }
      },
      dispose: () => {
        // Use the default Node.js SIGINT and SIGTERM handlers from now on.
        process.off("SIGINT", this.#onSigint);
        process.off("SIGTERM", this.#onSigterm);
      },
    };
  }

  override async start() {
    await super.start();

    // Override the default Node.js SIGINT handler to gracefully stop the test process
    // on CTRL+C.
    process.on("SIGINT", this.#onSigint);

    // Override the default Node.js SIGTERM handler to ensure the test process termination.
    process.once("SIGTERM", this.#onSigterm);
  }

  protected override getStartupInfo() {
    const pid = this.process.pid;
    if (pid === undefined) {
      return undefined;
    }

    return { pid };
  }

  protected override requestRootStop(_: AbortSignal) {
    // Does not throw if the process already finished.
    // Returns `false` instead (which is ignored).
    // Completion (monitor.wait) will still wait for the process group to finish.
    this.process.kill("SIGINT");
  }

  protected override requestTermination() {
    const pid = this.process.pid;

    if (pid === undefined) {
      // Node.js was unable to spawn the process, which means there is nothing to stop.
      // The completion promise will report the original error.
      return;
    }

    try {
      // Unconditionally terminate the process group.
      process.kill(-pid, "SIGKILL");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
        throw error;
      }

      // The process group completed concurrently.
      // This is fine, we can continue normally.
    }
  }

  readonly #onSigint = () => {
    if (!this.#sigintReceived) {
      // First SIGINT is forwarded to the process group.
      this.#sigintReceived = true;
      this.sendSigintToGroup();
      return;
    }

    // Removing the handler so the third SIGINT will use the default Node.js handler,
    // which terminates Allure.
    process.off("SIGINT", this.#onSigint);

    // The second SIGINT terminates the test process group.
    // Allure has a chance to complete the report generation.
    void this.terminate().catch((error) => {
      logError("Unable to terminate the test process group.", error);
    });
  };

  readonly #onSigterm = () => {
    void this.terminate()
      .catch((error) => logError("Unable to terminate the test process group.", error))
      .finally(() => process.kill(process.pid, "SIGTERM"));
  };

  private sendSigintToGroup() {
    const pid = this.process.pid;
    if (pid === undefined) {
      return;
    }

    try {
      process.kill(-pid, "SIGINT");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
        throw error;
      }
    }
  }
}

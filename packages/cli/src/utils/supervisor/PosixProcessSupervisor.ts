import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

import type { JobMonitor, SupervisedCommandOptions } from "./model.js";
import { ProcessSupervisorBase } from "./ProcessSupervisorBase.js";

const MONITOR_INTERVAL_MS = 100;

export class PosixProcessSupervisor extends ProcessSupervisorBase {
  protected shell: boolean = false;
  protected detached: boolean = true;

  protected monitor: JobMonitor;

  #sigintReceived: boolean = false;

  constructor(command: string, options: SupervisedCommandOptions) {
    super(command, options);
    this.monitor = {
      wait: async () => {
        const pid = this.process.pid;
        if (pid === undefined) {
          throw new Error("The process has not been spawned.");
        }

        while (true) {
          try {
            process.kill(-pid, 0);
          } catch (error) {
            const { code } = error as NodeJS.ErrnoException;

            if (code === "ESRCH") {
              // The group does not exist: all processes of the group have finished.
              // The exit code/signal is defined by the root process.
              return undefined;
            }

            if (code !== "EPERM") {
              throw error;
            }

            // EPERM: the group exists but cannot be signalled.
          }

          await delay(MONITOR_INTERVAL_MS);
        }
      },
      dispose: () => {
        process.off("SIGINT", this.#onSigint);
      },
    };
  }

  override start(): void {
    super.start();
    process.on("SIGINT", this.#onSigint);
  }

  protected requestRootStop() {
    // Does not throw if the process already finished.
    // Returns `false` instead (which is ignored).
    // Completion will still wait for the process group.
    this.process.kill("SIGINT");
  }

  protected requestTermination() {
    const pid = this.process.pid;

    if (pid === undefined) {
      // Node.js was unable to spawn the process, which means there is nothing to stop.
      // The completion promise will report the original error.
      return;
    }

    try {
      process.kill(-pid, "SIGKILL");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
        throw error;
      }

      // The process group completed concurrently.
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

    void this.terminate().then(
      () => process.exit(130),
      () => process.exit(130),
    );
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

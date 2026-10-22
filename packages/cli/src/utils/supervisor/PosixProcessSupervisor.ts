import { execFile } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

import { isDefined } from "@allurereport/reader-api";

import { logError } from "../logs.js";
import type { JobMonitor, SupervisedCommandOptions } from "./model.js";
import { ProcessSupervisorBase } from "./ProcessSupervisorBase.js";

const MONITOR_INTERVAL_MS = 100;
const PROCESS_GROUP_SCAN_INTERVAL_MS = 500;
const PROCESS_GROUP_SCAN_CONFIRMATIONS = 3;
const inspectProcesses = promisify(execFile);

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

        // Creates a stateful poller that infers completion after repeated
        // scans observe no live members and no newly observed exited PIDs.
        // This prevents unreaped zombies from keeping the supervisor
        // waiting indefinitely even though all group members have exited.
        const pollForCompletion = this.createProcessGroupCompletionPoller(pid);

        while (this.processGroupExists(pid) && !(await pollForCompletion())) {
          await delay(MONITOR_INTERVAL_MS);
        }

        // Returning `undefined` makes the base class use the root process's exit code and signal.
        return undefined;
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

  protected override async diagnoseRemainingProcesses() {
    const pgid = this.process.pid;

    const { stdout } = await inspectProcesses("ps", ["-A", "-ww", "-o", "pid=,ppid=,pgid=,stat=,args="], {
      timeout: 2_000,
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, LC_ALL: "C" },
    });

    const processes = stdout
      .split("\n")
      .map((line) => {
        const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(line);
        if (!match || Number(match[3]) !== pgid) {
          return undefined;
        }
        return { pid: Number(match[1]), ppid: Number(match[2]), pgid, state: match[4], commandLine: match[5] };
      })
      .filter(isDefined);

    this.diagnostic("process group snapshot after root exit", { pgid, listed: processes.length });
    for (const details of processes) {
      this.diagnostic("remaining process group member", details);
    }
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
      this.reportInterruption();
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
    this.reportForcedInterruption();
  };

  readonly #onSigterm = () => {
    void this.terminate()
      .catch((error) => logError("Unable to terminate the test process group.", error))
      .finally(() => process.kill(process.pid, "SIGTERM"));
  };

  private processGroupExists(pgid: number) {
    try {
      // Check if the process group exists.
      process.kill(-pgid, 0);
    } catch (error) {
      const { code } = error as NodeJS.ErrnoException;

      if (code === "ESRCH") {
        // The group does not exist: all processes of the group have finished.
        // This is a reliable completeness indicator.
        return false;
      }

      if (code !== "EPERM") {
        throw error;
      }

      // EPERM: the group exists but cannot be signalled.
    }

    // The group is running or kept alive by zombie processes.
    return true;
  }

  private createProcessGroupCompletionPoller(pgid: number) {
    let remainingConfirmations: number = PROCESS_GROUP_SCAN_CONFIRMATIONS;
    let previousExitedPids: Set<number> | undefined;
    let nextScanAt: number = Date.now();
    let inFlight: Promise<boolean> | undefined;

    const probeOnce = async () => {
      const now = Date.now();
      if (now >= nextScanAt) {
        const exitedPids = await this.scanProcessGroupForLiveMembers(pgid);
        nextScanAt = Date.now() + PROCESS_GROUP_SCAN_INTERVAL_MS;

        if (exitedPids === undefined) {
          remainingConfirmations = PROCESS_GROUP_SCAN_CONFIRMATIONS;
          // Definitely not complete
          return false;
        }

        if (previousExitedPids && exitedPids.isSubsetOf(previousExitedPids)) {
          // No new zombies.
          remainingConfirmations--;
          if (remainingConfirmations <= 0) {
            // The process group is considered complete after sufficient confidence.
            return true;
          }
        } else {
          // New zombies have appeared. Something might still be running.
          remainingConfirmations = PROCESS_GROUP_SCAN_CONFIRMATIONS;
        }

        previousExitedPids = exitedPids;
      }

      // A live member was observed, not enough confidence was reached, or the next scan is not due.
      return false;
    };

    return () => {
      if (inFlight === undefined) {
        inFlight = probeOnce()
          .catch((e) => {
            remainingConfirmations = PROCESS_GROUP_SCAN_CONFIRMATIONS;
            nextScanAt = Date.now() + PROCESS_GROUP_SCAN_INTERVAL_MS;
            this.error("Error occurred during process group probe", e);
            return false;
          })
          .finally(() => {
            inFlight = undefined;
          });
      }

      return inFlight;
    };
  }

  private async scanProcessGroupForLiveMembers(pgrpToCheck: number) {
    const { stdout: psOutput } = await inspectProcesses("ps", ["-A", "-o", "pid=", "-o", "pgid=", "-o", "stat="], {
      encoding: "utf-8",
      timeout: 2_000,
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, LC_ALL: "C" },
    });

    const exitedPids: Set<number> = new Set();

    for (const line of psOutput.split("\n")) {
      if (line.trim() === "") {
        continue;
      }

      const match = /^\s*(\d+)\s+(\d+)\s+(\S+)\s*$/.exec(line);
      if (!match) {
        throw new Error(`Unexpected format of ps output: ${line}`);
      }

      const [, pidText, pgidText, stat] = match;
      if (Number(pgidText) !== pgrpToCheck) {
        continue;
      }

      // Omit modifiers, such as in "Z+" or "Ss"
      const state = stat[0];

      if (state !== "Z" && state !== "X" && state !== "x") {
        // A reliable indicator that the process group is still running.
        return undefined;
      }

      exitedPids.add(Number(pidText));
    }

    // Getting here is an unreliable indicator of process group completeness.
    // Subject to race conditions, as processes may spawn and exit during the check.
    // Returning the list of current group processes.
    return exitedPids;
  }

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

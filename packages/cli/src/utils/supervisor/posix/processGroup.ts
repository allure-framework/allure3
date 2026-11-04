import { execFile } from "node:child_process";
import process from "node:process";
import { promisify } from "node:util";

export const PROCESS_GROUP_SCAN_INTERVAL_MS = 500;
export const PROCESS_GROUP_SCAN_CONFIRMATIONS = 3;

export type ProcessListReader = () => Promise<string>;

export type ProcessGroupScanResult =
  | { status: "live-members-found" }
  | { status: "no-live-members-found"; exitedPids: readonly number[] };

export type ProcessGroupScanner = (processGroupId: number) => Promise<ProcessGroupScanResult>;

export type ProcessGroupCompletionPollResult = "pending" | "complete";

export type ProcessGroupCompletionPoller = () => Promise<ProcessGroupCompletionPollResult>;

export type ProcessGroupCompletionPollerOptions = {
  processGroupId: number;
  scanProcessGroup: ProcessGroupScanner;
  reportError: (error: unknown) => void;
  now?: () => number;
};

const inspectProcesses = promisify(execFile);

const readProcessList: ProcessListReader = async () => {
  const { stdout } = await inspectProcesses("ps", ["-A", "-o", "pid=", "-o", "pgid=", "-o", "stat="], {
    encoding: "utf-8",
    timeout: 2_000,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, LC_ALL: "C" },
  });

  return stdout;
};

export const scanProcessGroup = async (
  processGroupId: number,
  readProcesses: ProcessListReader = readProcessList,
): Promise<ProcessGroupScanResult> => {
  const exitedPids: number[] = [];
  const psOutput = await readProcesses();

  for (const line of psOutput.split("\n")) {
    if (line.trim() === "") {
      continue;
    }

    const match = /^\s*(\d+)\s+(\d+)\s+(\S+)\s*$/.exec(line);
    if (!match) {
      throw new Error(`Unexpected format of ps output: ${line}`);
    }

    const [, pidText, pgidText, stat] = match;
    if (Number(pgidText) !== processGroupId) {
      continue;
    }

    // Omit modifiers, such as in "Z+" or "Ss".
    const state = stat[0];

    if (state !== "Z" && state !== "X" && state !== "x") {
      // A reliable indicator that the process group is still running.
      return { status: "live-members-found" };
    }

    exitedPids.push(Number(pidText));
  }

  // Getting here is an unreliable indicator of process group completeness.
  // Subject to race conditions, as processes may spawn and exit during the check.
  return { status: "no-live-members-found", exitedPids };
};

export const createProcessGroupCompletionPoller = ({
  processGroupId,
  scanProcessGroup,
  reportError,
  now = Date.now,
}: ProcessGroupCompletionPollerOptions): ProcessGroupCompletionPoller => {
  let remainingConfirmations: number = PROCESS_GROUP_SCAN_CONFIRMATIONS;
  let previousExitedPids: readonly number[] | undefined;
  let nextScanAt: number = now();
  let inFlight: Promise<ProcessGroupCompletionPollResult> | undefined;

  const probeOnce = async (): Promise<ProcessGroupCompletionPollResult> => {
    if (now() < nextScanAt) {
      return "pending";
    }

    const scanResult = await scanProcessGroup(processGroupId);
    nextScanAt = now() + PROCESS_GROUP_SCAN_INTERVAL_MS;

    if (scanResult.status === "live-members-found") {
      remainingConfirmations = PROCESS_GROUP_SCAN_CONFIRMATIONS;
      return "pending";
    }

    const { exitedPids } = scanResult;
    const previousExitedPidsAtScan = previousExitedPids;
    if (previousExitedPidsAtScan && exitedPids.every((pid) => previousExitedPidsAtScan.includes(pid))) {
      // No running processes detected and no new zombies.
      // Now we are more confident that all group processes have finished.
      remainingConfirmations--;

      if (remainingConfirmations <= 0) {
        // Enough confidence reached.
        return "complete";
      }
    } else {
      // New zombies have appeared. Something might still be running.
      remainingConfirmations = PROCESS_GROUP_SCAN_CONFIRMATIONS;
    }

    previousExitedPids = exitedPids;
    return "pending";
  };

  return () => {
    if (inFlight === undefined) {
      inFlight = probeOnce()
        .catch((error) => {
          remainingConfirmations = PROCESS_GROUP_SCAN_CONFIRMATIONS;
          nextScanAt = now() + PROCESS_GROUP_SCAN_INTERVAL_MS;
          reportError(error);
          return "pending" as const;
        })
        .finally(() => {
          inFlight = undefined;
        });
    }

    return inFlight;
  };
};

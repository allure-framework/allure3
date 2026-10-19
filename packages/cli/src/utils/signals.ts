import process from "node:process";

export const SIGNAL_EXIT_CODES: Partial<Record<NodeJS.Signals, number>> = {
  SIGINT: 130,
  SIGTERM: 143,
};

export const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 60_000;
export const COMMAND_TERMINATION_GRACE_MS = 5_000;

export type SignalInfo = {
  signal: NodeJS.Signals;
  code: number;
  receivedAt: number;
  deadline: number;
};

const exitCodeForSignal = (signal: NodeJS.Signals): number => SIGNAL_EXIT_CODES[signal] ?? 1;

export type SignalNotifier = {
  /** aborts the moment the first SIGINT/SIGTERM is received */
  signal: AbortSignal;
  /** the signal that triggered the abort, once received */
  info: () => SignalInfo | undefined;
  /** stop listening for signals */
  dispose: () => void;
};

export const notifySignals = (
  signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"],
  onRepeat?: (signal: NodeJS.Signals) => void,
): SignalNotifier => {
  const controller = new AbortController();
  let info: SignalInfo | undefined;

  const handler = (signal: NodeJS.Signals) => {
    if (info) {
      onRepeat?.(signal);
      return;
    }

    const receivedAt = Date.now();

    info = {
      signal,
      code: exitCodeForSignal(signal),
      receivedAt,
      deadline: receivedAt + GRACEFUL_SHUTDOWN_TIMEOUT_MS,
    };

    controller.abort();
  };

  for (const signal of signals) {
    process.on(signal, handler);
  }

  return {
    signal: controller.signal,
    info: () => info,
    dispose: () => {
      for (const signal of signals) {
        process.off(signal, handler);
      }
    },
  };
};

/** time left until the graceful-shutdown deadline, floored at 0; undefined if no signal received yet */
export const gracefulShutdownRemaining = (info: SignalInfo | undefined): number | undefined => {
  if (!info) {
    return undefined;
  }

  return Math.max(0, info.deadline - Date.now());
};

export const boundedTerminationSignal = (
  info: SignalInfo | undefined,
  graceMs: number = COMMAND_TERMINATION_GRACE_MS,
): AbortSignal => {
  const remaining = gracefulShutdownRemaining(info);
  const timeoutMs = remaining === undefined ? graceMs : Math.min(remaining, graceMs);

  return AbortSignal.timeout(timeoutMs);
};

/** resolves once the given signal aborts */
export const waitForAbort = (signal: AbortSignal): Promise<void> =>
  signal.aborted
    ? Promise.resolve()
    : new Promise((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));

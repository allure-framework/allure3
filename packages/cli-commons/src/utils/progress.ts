import debounce from "lodash.debounce";

export type ProgressLoggerOptions = {
  total: number;
  message: string;
  unitLabel: string;
  prefix?: string;
  maxLogs?: number;
  debounceMs?: number;
  silent?: boolean;
  log?: (message: string) => void;
};

export type ProgressLogger = {
  log: (force?: boolean) => void;
  increment: (delta?: number) => void;
  getCurrent: () => number;
  cancel?: () => void;
};

export const createProgressLogger = ({
  total,
  message,
  unitLabel,
  prefix,
  debounceMs = 5_000,
  silent = false,
  log = console.info,
}: ProgressLoggerOptions): ProgressLogger => {
  let current = 0;
  let lastProgressLog = -1;

  const formatMessage = () => `${prefix ? `${prefix}: ` : ""}${message}: ${current}/${total} ${unitLabel}`;

  const emitLog = () => {
    if (current === lastProgressLog) {
      return;
    }

    log(formatMessage());

    lastProgressLog = current;
  };

  const debouncedEmitLog = debounce(emitLog, debounceMs, { maxWait: debounceMs });

  const flushLog = () => {
    debouncedEmitLog.cancel();
    emitLog();
  };

  const logProgress = (force = false) => {
    if (silent) {
      return;
    }

    if (force) {
      flushLog();

      return;
    }

    if (current === total) {
      flushLog();

      return;
    }

    debouncedEmitLog();
  };

  return {
    log: logProgress,
    increment: (delta = 1) => {
      current = Math.min(total, current + delta);

      if (silent) {
        return;
      }

      if (current === total) {
        flushLog();

        return;
      }

      logProgress();
    },
    getCurrent: () => current,
    cancel: () => debouncedEmitLog.cancel(),
  };
};

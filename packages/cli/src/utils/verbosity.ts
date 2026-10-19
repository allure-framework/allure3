import { type LogLevel, setGlobalLogLevel } from "@allurereport/cli-commons";
import { UsageError } from "clipanion";

export type Verbosity = "verbose" | "quiet" | "normal";

// `--verbose` lowers the log level, `--quiet` keeps errors only; otherwise `ALLURE_LOG_LEVEL` decides
const LOG_LEVELS: Record<Verbosity, LogLevel | undefined> = {
  verbose: "verbose",
  quiet: "error",
  normal: undefined,
};

const isVerboseFlag = (arg: string) => arg === "--verbose" || arg === "-v";
const isQuietFlag = (arg: string) => arg === "--quiet" || arg === "-q";

let currentVerbosity: Verbosity = "normal";

export const isQuiet = () => currentVerbosity === "quiet";

/**
 * Pulls the global `--verbose/-v` and `--quiet/-q` flags out of the CLI arguments.
 * Everything after `--` belongs to the nested command and is never inspected.
 * A lone `-v` keeps its historical meaning (print the version).
 */
export const extractVerbosityFlags = (args: string[]): { args: string[]; verbosity: Verbosity } => {
  if (args.length === 1 && args[0] === "-v") {
    return { args, verbosity: "normal" };
  }

  const separator = args.indexOf("--");
  const own = separator === -1 ? args : args.slice(0, separator);
  const nested = separator === -1 ? [] : args.slice(separator);
  const verbose = own.some(isVerboseFlag);
  const quiet = own.some(isQuietFlag);

  if (verbose && quiet) {
    throw new UsageError("--verbose and --quiet cannot be used together");
  }

  return {
    args: [...own.filter((arg) => !isVerboseFlag(arg) && !isQuietFlag(arg)), ...nested],
    verbosity: verbose ? "verbose" : quiet ? "quiet" : "normal",
  };
};

export const applyVerbosity = (verbosity: Verbosity) => {
  currentVerbosity = verbosity;
  setGlobalLogLevel(LOG_LEVELS[verbosity]);
};

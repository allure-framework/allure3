import { setGlobalLogLevel } from "@allurereport/cli-commons";
import { UsageError } from "clipanion";

export type Verbosity = "verbose" | "quiet" | "normal";

const VERBOSE_FLAGS = new Set(["--verbose", "-v"]);
const QUIET_FLAGS = new Set(["--quiet", "-q"]);

let currentVerbosity: Verbosity = "normal";

export const getVerbosity = (): Verbosity => currentVerbosity;

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
  const rest = separator === -1 ? [] : args.slice(separator);
  const verbose = own.some((arg) => VERBOSE_FLAGS.has(arg));
  const quiet = own.some((arg) => QUIET_FLAGS.has(arg));

  if (verbose && quiet) {
    throw new UsageError("--verbose and --quiet cannot be used together");
  }

  const filtered = own.filter((arg) => !VERBOSE_FLAGS.has(arg) && !QUIET_FLAGS.has(arg));

  return { args: [...filtered, ...rest], verbosity: verbose ? "verbose" : quiet ? "quiet" : "normal" };
};

/**
 * `--verbose` lowers the log level to `verbose`, `--quiet` raises it to `error`.
 * Without either flag the level still comes from `ALLURE_LOG_LEVEL`.
 */
export const applyVerbosity = (verbosity: Verbosity) => {
  currentVerbosity = verbosity;
  setGlobalLogLevel(verbosity === "verbose" ? "verbose" : verbosity === "quiet" ? "error" : undefined);
};

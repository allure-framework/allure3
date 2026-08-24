import { resolve } from "node:path";

import { findAllureResultDirectories } from "./fileSystem.js";

/**
 * Normalize Config.resultsDir / CLI patterns to a non-empty string[].
 */
export const normalizeResultsDir = (value?: string | readonly string[]): string[] => {
  if (value === undefined) {
    return [];
  }

  const values = typeof value === "string" ? [value] : [...value];

  return values.filter((entry) => entry.length > 0);
};

/**
 * CLI non-empty after normalize wins; else config; else [] ("no override").
 * Callers choose one-shot default glob vs live name watcher when [].
 */
export const resolveResultsPatterns = (
  cliPatterns?: string | readonly string[] | null,
  configResultsDir?: string | readonly string[],
): string[] => {
  const fromCli = normalizeResultsDir(cliPatterns ?? undefined);

  if (fromCli.length) {
    return fromCli;
  }

  return normalizeResultsDir(configResultsDir);
};

/**
 * Strip trailing separators and resolve so mark:true glob paths do not flap in set diffs.
 */
export const normalizeResultsDirectoryPath = (path: string): string => {
  return resolve(path.replace(/[/\\]+$/, ""));
};

export type ParsedRunCommand = {
  command: string | undefined;
  commandArgs: string[];
};

/**
 * Parse nested command argv for `allure run` / `allure agent` Rest.
 * Never throws — callers decide how to handle a missing command.
 * Strips only leading `--` tokens (Clipanion may leave a separator); nested `--` in the command stay.
 */
export const parseRunCommand = (args: string[]): ParsedRunCommand => {
  let start = 0;

  while (start < args.length && args[start] === "--") {
    start += 1;
  }

  const commandParts = args.slice(start);

  if (!commandParts.length) {
    return { command: undefined, commandArgs: [] };
  }

  return {
    command: commandParts[0],
    commandArgs: commandParts.slice(1),
  };
};

/**
 * Single choke point for generate-family / Rest-based readers: resolve CLI > config, then find dirs.
 * Empty resolved patterns → findAllureResultDirectories injects the default ./**\/allure-results glob.
 */
export const resolveAndFindResultsDirs = async (
  cwd: string,
  cliPatterns: readonly string[],
  configResultsDir?: string | string[],
) => {
  const patterns = resolveResultsPatterns(cliPatterns, configResultsDir);

  return findAllureResultDirectories(cwd, patterns);
};

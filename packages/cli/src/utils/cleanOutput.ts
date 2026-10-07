import { rm } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, parse, relative, resolve } from "node:path";
import { cwd as processCwd } from "node:process";

import { isFileNotFoundError } from "@allurereport/core";

const isSameOrInside = (parent: string, child: string) => {
  const rel = relative(parent, child);

  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

/**
 * Returns the reason why the output directory must not be cleaned, or undefined when it is safe to remove.
 * A directory is unsafe when it is (or contains) the working directory, the process directory,
 * the home directory, a filesystem root, or any input of the report (a results directory or a dump file).
 */
export const getUnsafeCleanReason = (params: {
  output: string;
  cwd: string;
  resultsDirs?: string[];
  inputFiles?: string[];
}): string | undefined => {
  const cwd = resolve(params.cwd);
  const output = resolve(cwd, params.output);

  if (output === parse(output).root) {
    return "it is a filesystem root";
  }

  if (isSameOrInside(output, cwd) || isSameOrInside(output, processCwd())) {
    return "it is the current working directory or contains it";
  }

  if (isSameOrInside(output, homedir())) {
    return "it is the home directory or contains it";
  }

  for (const dir of params.resultsDirs ?? []) {
    const resultsDir = resolve(cwd, dir);

    if (isSameOrInside(output, resultsDir)) {
      return `it is the results directory (${resultsDir}) or contains it`;
    }
    if (isSameOrInside(resultsDir, output)) {
      return `it is located inside the results directory (${resultsDir})`;
    }
  }

  for (const file of params.inputFiles ?? []) {
    const inputFile = resolve(cwd, file);

    if (isSameOrInside(output, inputFile)) {
      return `it contains an input file (${inputFile})`;
    }
  }

  return undefined;
};

/**
 * Removes the report output directory. Throws when the path is considered dangerous.
 * A missing directory is not an error.
 */
export const cleanOutputDirectory = async (params: Parameters<typeof getUnsafeCleanReason>[0]) => {
  const reason = getUnsafeCleanReason(params);
  const output = resolve(params.cwd, params.output);

  if (reason) {
    throw new Error(`Refusing to clean the output directory ${output}: ${reason}`);
  }

  try {
    await rm(output, { recursive: true });
  } catch (e) {
    if (!isFileNotFoundError(e)) {
      throw e;
    }
  }
};

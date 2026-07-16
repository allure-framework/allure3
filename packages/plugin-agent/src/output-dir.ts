import { readdir, stat } from "node:fs/promises";

import { AgentUsageError } from "./errors.js";
import { isFileNotFoundError } from "./utils.js";

/**
 * An explicit, caller-provided agent output directory is recursively deleted before it is written
 * (both by a run/inspect and by the invalid-expectation fallback). Only allow a directory that is
 * absent or empty, so a mistyped path (e.g. `--output ./src`) cannot destroy unrelated files.
 * Managed temp outputs are created fresh and never need this check.
 */
export const assertExplicitAgentOutputDirIsSafe = async (outputDir: string) => {
  let stats;

  try {
    stats = await stat(outputDir);
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return;
    }

    throw error;
  }

  if (!stats.isDirectory()) {
    throw new AgentUsageError(`--output ${JSON.stringify(outputDir)} is not a directory; use a new or empty directory`);
  }

  if ((await readdir(outputDir)).length > 0) {
    throw new AgentUsageError(
      `refusing to use --output ${JSON.stringify(outputDir)}: the agent recursively deletes its output directory, ` +
        `so it must be a new or empty directory.`,
    );
  }
};

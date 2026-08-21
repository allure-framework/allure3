import type { Watcher } from "@allurereport/directory-watcher";
import { difference, watch } from "@allurereport/directory-watcher";

import { findDirectoriesByGlobs } from "../../utils/fileSystem.js";
import { normalizeResultsDirectoryPath } from "../../utils/resultsPatterns.js";

/**
 * Live re-glob discovery for patterned results dirs.
 * Uses directory-watcher `watch()` so polls never overlap; paths are normalized before set diff.
 */
export const allureResultsDirectoriesGlobWatcher = (
  cwd: string,
  patterns: readonly string[],
  update: (newAllureResults: Set<string>, deletedAllureResults: Set<string>) => Promise<void>,
  options: { indexDelay?: number; abortController?: AbortController } = {},
): Watcher => {
  const { abortController = new AbortController(), indexDelay = 600 } = options;
  let previousAllureResults: Set<string> = new Set();

  const callback = async () => {
    if (abortController.signal.aborted) {
      return;
    }

    const matched = await findDirectoriesByGlobs(cwd, patterns);
    const currentAllureResults = new Set(matched.map(normalizeResultsDirectoryPath));
    const [added, deleted] = difference(previousAllureResults, currentAllureResults);

    await update(added, deleted);
    previousAllureResults = currentAllureResults;
  };

  return watch(callback, callback, callback, { indexDelay, abortController });
};

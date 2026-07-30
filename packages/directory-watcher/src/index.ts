import console from "node:console";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { watch as chokidarWatch } from "chokidar";
import type { EventName } from "chokidar/handler.js";

// large, essentially never-relevant directories that can exhaust the fs-watch handle limit (EMFILE);
// .git is always ignored too, on top of whatever the project's own .gitignore adds
const DEFAULT_IGNORED_DIR_NAMES = ["node_modules", "dist", "build", "out", "coverage", ".git"];

// chokidar always normalizes paths to forward slashes internally, even on Windows, so splitting
// on the platform's own path.sep (`\` there) would never find a segment boundary
const isIgnoredByDefault = (path: string, gitignorePatterns: string[]): boolean => {
  const segments = path.split(/[\\/]/);

  return (
    segments.some((segment) => DEFAULT_IGNORED_DIR_NAMES.includes(segment)) ||
    gitignorePatterns.some((pattern) => segments.includes(pattern))
  );
};

// ponytail: only plain directory/file names from .gitignore are honored (no glob wildcards, no
// negation) — good enough for the common "ignore this folder" case chokidar itself doesn't cover;
// reach for a real gitignore-matching library if richer patterns turn out to matter
const readGitignoredNames = (directory: string): string[] => {
  try {
    return readFileSync(join(directory, ".gitignore"), "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/^\/|\/$/g, ""))
      .filter((line) => line && !line.startsWith("#") && !line.includes("*") && !line.includes("!"));
  } catch {
    return [];
  }
};

/**
 * Setup file system watcher for a given directory (includes subdirectories and all nested files)
 * Calls given callback every time file is created, changed or deleted
 * Returns function to stop watching
 * @example
 * ```js
 * const unwatch = watchDirectory("path/to/directory", () => {
 *   console.log("directory changed");
 * });
 *
 * await unwatch();
 * ```
 * @param directory Directory path to watch
 * @param handler Callback to handle every directory change
 * @param options the options object. usePolling — Use file system polling instead of native watcher. Disable if you have issues with performance.
 * ignored — additional glob pattern(s) or predicate excluded from being watched, on top of the built-in
 * defaults (node_modules, .git, dist, …, plus whatever `directory`'s own .gitignore lists); pass
 * `false` to disable the built-in defaults entirely.
 * @returns unwatch
 */
const watchDirectory = (
  directory: string,
  handler: (eventName: EventName, path: string) => void | Promise<void>,
  options: {
    usePolling?: boolean;
    ignoreInitial?: boolean;
    ignored?: string | string[] | ((path: string) => boolean) | false;
  } = {},
) => {
  const { usePolling = false, ignoreInitial = false, ignored } = options;

  const extraIgnored = ignored === false || ignored === undefined ? [] : Array.isArray(ignored) ? ignored : [ignored];
  const gitignorePatterns = ignored === false ? [] : readGitignoredNames(directory);
  const ignoredPatterns = [
    ...(ignored === false ? [] : [(path: string) => isIgnoredByDefault(path, gitignorePatterns)]),
    ...extraIgnored,
  ];

  const watcher = chokidarWatch(directory, {
    persistent: true,
    usePolling,
    ignoreInitial,
    ignored: ignoredPatterns,
  });

  watcher.on("all", async (eventName, path) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await handler(eventName, path);
  });
  watcher.on("error", (error) => {
    console.log("error", error);
  });

  return () => watcher.close();
};

export default watchDirectory;

export type { Watcher } from "./watcher.js";
export {
  findMatching,
  newFilesInDirectoryWatcher,
  allureResultsDirectoriesWatcher,
  delayedFileProcessingWatcher,
} from "./watcher.js";

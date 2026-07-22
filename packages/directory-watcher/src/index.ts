import console from "node:console";
import { sep } from "node:path";

import { watch as chokidarWatch } from "chokidar";
import type { EventName } from "chokidar/handler.js";

// non-dotfile directories that are essentially never relevant to watch, and that can be huge
// enough (deps, build output) to exhaust the OS's per-process fs-watch handle limit (EMFILE) if
// chokidar is left to recurse into them.
const DEFAULT_IGNORED_DIR_NAMES = ["node_modules", "dist", "build", "out", "coverage"];

// dotfiles/dot-directories (.git, .yarn, .cache, .codegraph, .vscode, .idea, …) are near-never
// relevant to source watching either, are numerous enough on their own to matter for the fd
// limit, and sometimes contain things a plain fs.watch can't even handle (e.g. .codegraph's unix
// socket, which errors with ENOTSUP/UNKNOWN if chokidar tries to watch it). Ignoring the whole
// class by convention avoids both problems without having to enumerate every tool's dotfolder by
// name.
const isDotSegment = (segment: string): boolean => segment.length > 1 && segment.startsWith(".");

const isIgnoredByDefault = (path: string): boolean =>
  path.split(sep).some((segment) => isDotSegment(segment) || DEFAULT_IGNORED_DIR_NAMES.includes(segment));

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
 * defaults (node_modules, .git, dist, …); pass `false` to disable the built-in defaults entirely.
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
  const ignoredPatterns = [...(ignored === false ? [] : [isIgnoredByDefault]), ...extraIgnored];

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

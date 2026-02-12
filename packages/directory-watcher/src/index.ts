import { watch as chokidarWatch } from "chokidar";
import type { EventName } from "chokidar/handler.js";
import console from "node:console";

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
 * @param options the options object. usePolling — Use file system polling instead of native watcher. Disable if you have issues with performance
 * @returns unwatch
 */
const watchDirectory = (
  directory: string,
  handler: (eventName: EventName, path: string) => void | Promise<void>,
  options: { usePolling?: boolean; ignoreInitial?: boolean } = {},
) => {
  const { usePolling = false, ignoreInitial = false } = options;
  const watcher = chokidarWatch(directory, { persistent: true, usePolling, ignoreInitial });

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

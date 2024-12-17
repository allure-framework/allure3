import console from "node:console";
import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
import { createReadStream } from "node:fs";
import { opendir, realpath, stat } from "node:fs/promises";
import { join } from "node:path";
import { setImmediate, setTimeout } from "node:timers/promises";

// Somehow, @types/node doesn't contain the Error type, so it comes from the browser, where the error code doesn't exist.
export const isFileNotFoundError = (e: unknown): e is Error => e instanceof Error && "code" in e && e.code === "ENOENT";

// Set.prototype.difference is only available since node 22
// NOTE: we're don't really care about the complexity since usually the sets have only few elements (<10)
export const difference = (before: Set<string>, after: Set<string>): [Set<string>, Set<string>] => {
  const added = new Set<string>();
  const deleted = new Set<string>(before);
  for (const value of after) {
    if (!deleted.has(value)) {
      added.add(value);
    } else {
      deleted.delete(value);
    }
  }
  return [added, deleted];
};

/**
 * The method crawl directory to find matching files. Please note, that the
 * recursive search in matched directories are not performed.
 */
export const findMatching = async (
  watchDirectory: string,
  existingResults: Set<string>,
  match: (dirent: Dirent) => boolean,
  maximumDepth: number = 5,
) => {
  try {
    const dir = await opendir(watchDirectory);
    for await (const dirent of dir) {
      const path = join(dirent.parentPath, dirent.name);

      // shouldn't be looking in private folders
      if (dirent.name.at(0) === "." || dirent.name === "node-modules") {
        continue;
      }

      if (existingResults.has(path)) {
        continue;
      }

      if (match(dirent)) {
        existingResults.add(path);
        continue;
      }

      if (dirent.isDirectory() && maximumDepth > 0) {
        await findMatching(path, existingResults, match, maximumDepth - 1);
      }
    }
  } catch (e) {
    if (isFileNotFoundError(e)) {
      existingResults.clear();
      return;
    }
    console.error("can't read directory", e);
  }
};

const findFiles = async (
  watchDirectory: string,
  existingResults: Set<string>,
  onNewFile: (file: string, dirent: Dirent) => Promise<void>,
  recursive: boolean,
) => {
  try {
    const dir = await opendir(watchDirectory, { recursive });
    for await (const dirent of dir) {
      if (dirent.isDirectory()) {
        continue;
      }

      const path = join(dirent.parentPath, dirent.name);
      if (existingResults.has(path)) {
        continue;
      }

      try {
        await onNewFile(path, dirent);
        existingResults.add(path);
      } catch (e) {
        if (!isFileNotFoundError(e)) {
          console.error("can't process file", path, e);
        }
      }
    }
  } catch (e) {
    if (isFileNotFoundError(e)) {
      existingResults.clear();
      return;
    }
    console.error("can't read directory", e);
  }
};

const singleIteration = async (callback: () => Promise<void>, ...ac: AbortController[]): Promise<void> => {
  return setImmediate<void>(undefined, { signal: AbortSignal.any(ac.map((c) => c.signal)) })
    .then(() => callback())
    .catch((err) => {
      if (err.name === "AbortError") {
        return;
      }
      console.error("can't execute callback", err);
    });
};

const repeatedIteration = async (
  indexInterval: number,
  callback: () => Promise<void>,
  ...ac: AbortController[]
): Promise<void> => {
  return setTimeout<void>(indexInterval, undefined, { signal: AbortSignal.any(ac.map((c) => c.signal)) })
    .then(() => callback())
    .then(() => repeatedIteration(indexInterval, callback, ...ac));
};

interface WatchOptions {
  indexDelay?: number;
  abortController?: AbortController;
}

const noop = async () => {};

export interface Watcher {
  abort: (immediately?: boolean) => Promise<void>;
  initialScan: () => Promise<void>;
  watchEnd: () => Promise<void>;
}

const watch = (
  initialCallback: () => Promise<void>,
  iterationCallback: () => Promise<void>,
  doneCallback: () => Promise<void>,
  options: WatchOptions = {},
): Watcher => {
  const { indexDelay = 300, abortController: haltAc = new AbortController() } = options;
  const gracefulShutdownAc = new AbortController();

  const init = singleIteration(initialCallback, haltAc);
  const timeout = init
    .then(() => repeatedIteration(indexDelay, iterationCallback, haltAc, gracefulShutdownAc))
    .catch((err) => {
      if (err.name === "AbortError") {
        return;
      }
      console.error("can't execute callback", err);
    })
    .then(() => singleIteration(doneCallback, haltAc));

  return {
    abort: async (immediately = false) => {
      if (immediately) {
        haltAc.abort();
      } else {
        gracefulShutdownAc.abort();
      }
      await timeout;
    },
    initialScan: async () => {
      await init;
    },
    watchEnd: async () => {
      await timeout;
    },
  };
};

interface WatchNewFilesOptions extends WatchOptions {
  recursive?: boolean;
  indexDelay?: number;
  ignoreInitial?: boolean;
  abortController?: AbortController;
}

export const newFilesInDirectoryWatcher = (
  directory: string,
  onNewFile: (file: string, dirent: Dirent) => Promise<void>,
  options: WatchNewFilesOptions = {},
): Watcher => {
  const { recursive = true, ignoreInitial = false, ...rest } = options;
  const indexedFiles: Set<string> = new Set();

  const initialCallback = async () => {
    await findFiles(directory, indexedFiles, ignoreInitial ? noop : onNewFile, recursive);
  };
  const iterationCallback = async () => {
    await findFiles(directory, indexedFiles, onNewFile, recursive);
  };

  return watch(initialCallback, iterationCallback, iterationCallback, rest);
};

export const allureResultsDirectoriesWatcher = (
  directory: string,
  update: (newAllureResults: Set<string>, deletedAllureResults: Set<string>) => Promise<void>,
  options: WatchOptions = {},
): Watcher => {
  let previousAllureResults: Set<string> = new Set();

  const callback = async () => {
    const currentAllureResults: Set<string> = new Set();
    await findMatching(
      directory,
      currentAllureResults,
      (dirent) => dirent.isDirectory() && dirent.name === "allure-results",
    );
    const [added, deleted] = difference(previousAllureResults, currentAllureResults);
    await update(added, deleted);
    previousAllureResults = currentAllureResults;
  };

  return watch(callback, callback, callback, options);
};

interface FileContentWatcherOptions extends WatchOptions {
  minProcessingDelay?: number;
  maxProcessingDelay?: number;
}

interface FileInfo {
  size: number;
  mtimeMs: number;
  timestamp: number;
}

const calculateInfo = async (file: string): Promise<FileInfo | null> => {
  try {
    const stats = await stat(file);
    if (!stats.isFile()) {
      return null;
    }
    const size = stats.size;
    const mtimeMs = stats.mtimeMs;
    const timestamp = Date.now();
    return { size, mtimeMs, timestamp };
  } catch (e) {
    if (isFileNotFoundError(e)) {
      return null;
    }
    throw e;
  }
};

interface FileChangingWaitOptions {
  maxWait: number;
  minWait: number;
}

const waitUntilFileStopChanging = async (
  file: string,
  info: FileInfo,
  options: FileChangingWaitOptions,
): Promise<boolean> => {
  const start = Date.now();
  const { maxWait, minWait } = options;

  const prev: FileInfo = { ...info };
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const now = Date.now();
    if (now - start > maxWait) {
      return false;
    }
    const sinceChange = now - prev.timestamp;
    if (sinceChange < minWait) {
      await setTimeout(Math.min(0, maxWait, minWait - sinceChange + 1));
    }
    const current = await calculateInfo(file);
    if (!current) {
      // the file is gone;
      return false;
    }

    const sameSize = current.size === prev.size;
    const sameMtimeMs = current.mtimeMs === prev.mtimeMs;
    if (sameSize && sameMtimeMs) {
      // no changes since last check
      return true;
    }
    prev.size = current.size;
    prev.mtimeMs = current.mtimeMs;
    prev.timestamp = current.timestamp;
  }
};

export const delayedFileProcessingWatcher = (
  processFile: (file: string) => Promise<void>,
  options: FileContentWatcherOptions = {},
): Watcher & { addFile: (file: string) => Promise<void> } => {
  const { minProcessingDelay = 200, maxProcessingDelay = 10_000, ...rest } = options;
  const files = new Map<string, FileInfo>();
  const success = new Set<string>();
  const errors = new Set<string>();

  const addFile = async (file: string): Promise<void> => {
    try {
      const filePath = await realpath(file, { encoding: "utf-8" });
      const info = await calculateInfo(filePath);
      if (!info) {
        return;
      }
      files.set(filePath, info);
    } catch (e) {
      if (isFileNotFoundError(e)) {
        return;
      }
      throw e;
    }
  };

  // the regular callback will only process files that are ready
  const callback = async () => {
    for (const [file, info] of files) {
      const now = Date.now();
      const sinceChange = now - info.timestamp;
      if (sinceChange < minProcessingDelay) {
        // not yet the time to process the file
        continue;
      }
      try {
        await processFile(file);
      } catch (e) {
        if (!isFileNotFoundError(e)) {
          console.log(`could not process file ${file}`, e);
        }
        errors.add(file);
      }
      files.delete(file);
      success.add(file);
    }
  };

  // the done callback will ensure all the files are processed and will wait to
  // the processing delay if needed
  const doneCallback = async () => {
    for (const [file, info] of files) {
      const waitedSuccessfully = await waitUntilFileStopChanging(file, info, {
        minWait: minProcessingDelay,
        maxWait: maxProcessingDelay,
      });
      if (waitedSuccessfully) {
        try {
          await processFile(file);
        } catch (e) {
          if (!isFileNotFoundError(e)) {
            console.log(`could not process file ${file}`, e);
          }
          errors.add(file);
        }
        files.delete(file);
        success.add(file);
      } else {
        console.error(`can't process file ${file}: file deleted or contents keep changing`);
        errors.add(file);
      }
    }
  };

  const watcher = watch(callback, callback, doneCallback, rest);
  return {
    ...watcher,
    addFile,
  };
};

export const md5File = async (path: string): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const output = createHash("md5");
    const input = createReadStream(path);

    input.on("error", (err) => {
      reject(err);
    });

    output.once("readable", () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      resolve(output.read().toString("hex"));
    });

    input.pipe(output);
  });
};

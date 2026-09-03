import { once } from "node:events";
import { type FileHandle, mkdir, open } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import type { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

import {
  type AllureHistory,
  type HistoryDataPoint,
  type HistoryTestResult,
  type MetricSample,
  normalizeHistoryDataPointUrls,
  type TestCase,
  type TestResult,
} from "@allurereport/core-api";

import { isFileNotFoundError } from "./utils/misc.js";

const createHistoryItems = (testResults: TestResult[], remoteUrl: string) => {
  return testResults
    .filter((tr) => tr.historyId)
    .map(
      ({
        id,
        name,
        fullName,
        environment,
        historyId,
        status,
        error: { message, trace } = {},
        start,
        stop,
        duration,
        labels,
      }) => {
        return {
          id,
          name,
          fullName,
          environment,
          status,
          message,
          trace,
          start,
          stop,
          duration,
          labels,
          url: remoteUrl,
          historyId: historyId!,
          reportLinks: [],
        } as HistoryTestResult;
      },
    )
    .reduce(
      (acc, item) => {
        acc[item.historyId!] = item;

        return acc;
      },
      {} as Record<string, HistoryTestResult>,
    );
};

const metricsToHistoryValues = (metrics: MetricSample[]): Record<string, number> => {
  const grouped = new Map<string, number[]>();

  for (const metric of metrics) {
    if (!metric.key || !Number.isFinite(metric.value)) {
      continue;
    }

    grouped.set(metric.key, [...(grouped.get(metric.key) ?? []), metric.value]);
  }

  return Object.fromEntries(
    [...grouped.entries()].map(([key, values]) => [key, values.reduce((acc, value) => acc + value, 0) / values.length]),
  );
};

export const createHistory = (
  reportUuid: string,
  reportName: string = "Allure Report",
  testCases: TestCase[],
  testResults: TestResult[],
  remoteUrl: string = "",
  metrics: MetricSample[] = [],
): HistoryDataPoint => {
  const knownTestCaseIds = testCases.map((tc) => tc.id);

  return {
    uuid: reportUuid,
    name: reportName,
    timestamp: new Date().getTime(),
    knownTestCaseIds,
    testResults: createHistoryItems(testResults, remoteUrl),
    metrics: metricsToHistoryValues(metrics),
    url: remoteUrl,
  };
};

/**
 * Streams opened on a `FileHandle` with `autoClose: false` are never destroyed on their own, and
 * the handle stays referenced until they emit "close". `FileHandle.close()` waits for that
 * reference to be released, so leaving such a stream behind makes the close never settle: the
 * awaiting code hangs and the process may exit silently with code 0. Destroy them explicitly.
 */
const closeStream = async (stream: Readable | Writable): Promise<void> => {
  if (stream.closed) {
    return;
  }

  await new Promise<void>((resolve) => {
    stream.once("close", () => resolve());
    // releasing the resources must not fail the operation the stream has already completed
    stream.once("error", () => resolve());
    stream.destroy();
  });
};

/**
 * Depending on the runtime, destroying a stream may also close the descriptor it was opened on,
 * so the handle can already be gone by the time we close it ourselves.
 */
const closeFileHandle = async (file: FileHandle): Promise<void> => {
  try {
    await file.close();
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== "EBADF") {
      throw err;
    }
  }
};

export class AllureLocalHistory implements AllureHistory {
  #cachedHistory: HistoryDataPoint[] = [];

  constructor(
    private readonly params: {
      historyPath: string;
      limit?: number;
    },
  ) {}

  async readHistory() {
    if (this.#cachedHistory.length > 0) {
      return this.#cachedHistory;
    }

    const fullPath = path.resolve(this.params.historyPath);
    const historyFile = await this.#openFileToReadIfExists(fullPath);

    if (historyFile === undefined) {
      return [];
    }

    const openedStreams: (Readable | Writable)[] = [];

    try {
      const start = await this.#findFirstEntryAddress(historyFile, this.params.limit);
      const stream = historyFile.createReadStream({ start, encoding: "utf-8", autoClose: false });

      openedStreams.push(stream);

      const historyPoints: HistoryDataPoint[] = [];
      const readlineInterface = readline
        .createInterface({ input: stream, terminal: false, crlfDelay: Infinity })
        .on("line", (line) => {
          if (line && line.trim().length) {
            const historyEntry = normalizeHistoryDataPointUrls(JSON.parse(line));

            historyPoints.push(historyEntry);
          }
        });

      await once(readlineInterface, "close");

      this.#cachedHistory = historyPoints;

      return this.#cachedHistory;
    } finally {
      await this.#closeStreams(openedStreams);
      await closeFileHandle(historyFile);
    }
  }

  async appendHistory(data: HistoryDataPoint) {
    const normalizedData = normalizeHistoryDataPointUrls(data);
    const fullPath = path.resolve(this.params.historyPath);
    const parentDir = path.dirname(fullPath);
    const { limit } = this.params;

    await mkdir(parentDir, { recursive: true });

    const { file: historyFile, exists: historyExists } = await this.#ensureFileOpenedToAppend(fullPath);
    const openedStreams: (Readable | Writable)[] = [];

    try {
      const dst = historyFile.createWriteStream({ encoding: "utf-8", start: 0, autoClose: false });

      openedStreams.push(dst);

      if (limit === 0 && historyExists) {
        await historyFile.truncate(0);
        return;
      }

      if (limit === 0 && !historyExists) {
        return;
      }

      if (historyExists) {
        // move up to `limit-1` most recent entries to the beginning of the file
        const start = await this.#findFirstEntryAddress(historyFile, limit ? limit - 1 : undefined);
        const src = historyFile.createReadStream({ start, autoClose: false });

        openedStreams.push(src);

        await pipeline(src, dst, { end: false });
      }

      // append a new entry; the total number is up to `limit`.
      const sources = [JSON.stringify(normalizedData), Buffer.from([0x0a])];

      await pipeline(sources, dst);

      if (historyExists) {
        await historyFile.truncate(dst.bytesWritten);
      }
    } finally {
      await this.#closeStreams(openedStreams);
      await closeFileHandle(historyFile);

      // in case when limit is undefined – the history is unlimited, so we need to add the point too
      if (limit !== 0) {
        this.#cachedHistory.push(normalizedData);
      }

      if (limit) {
        this.#cachedHistory.splice(limit);
      }
    }
  }

  // the streams have to be released in the order they were opened in: destroying a reader that
  // shares its handle with a still open writer never completes, while destroying the writer
  // closes the reader along with it
  #closeStreams = async (streams: (Readable | Writable)[]) => {
    for (const stream of streams) {
      await closeStream(stream);
    }
  };

  #openFileToReadIfExists = async (filePath: string) => {
    try {
      return await open(filePath, "r");
    } catch (e) {
      if (isFileNotFoundError(e)) {
        return undefined;
      }
      throw e;
    }
  };

  #ensureFileOpenedToAppend = async (filePath: string) => {
    try {
      return {
        file: await open(filePath, "r+"),
        exists: true,
      };
    } catch (e) {
      if (isFileNotFoundError(e)) {
        return {
          file: await open(filePath, "w"),
          exists: false,
        };
      }
      throw e;
    }
  };

  #findFirstEntryAddress = async (jsonlFile: FileHandle, limit: number | undefined) => {
    if (limit === undefined) {
      // The history is unlimited.
      return 0;
    }

    if (limit < 0) {
      throw new Error(`Invalid history limit ${limit}. A history limit must be a positive integer number`);
    }

    const stat = await jsonlFile.stat();
    let { size: position } = stat;
    const { mtimeMs: originalMtime } = stat;

    if (position === 0 || limit === 0) {
      // position === 0 means an empty file; we exit early to avoid an extra allocation.
      // limit === 0 means no need to read.
      return position;
    }

    const buffer = Buffer.alloc(Buffer.poolSize);

    while (position) {
      const bytesToRead = Math.min(position, buffer.byteLength);

      // `position` is guaranteed to be at least one, so it's safe to decrement.
      position -= bytesToRead;

      const { bytesRead } = await jsonlFile.read({ buffer, length: bytesToRead, position });

      if (bytesRead !== bytesToRead) {
        this.#throwUnexpectedReadError(jsonlFile, originalMtime, bytesToRead, bytesRead);
      }

      for (let i = bytesToRead - 1; i >= 0; i--) {
        // In UTF-8, it's guaranteed that the only thing a 0x0a byte represents is the '\n' character.
        if (buffer[i] === 0x0a) {
          if (limit-- === 0) {
            return position + i + 1;
          }
        }
      }
    }

    // Limit not reached; take all entries.
    return 0;
  };

  #throwUnexpectedReadError = async (file: FileHandle, mtime: number, expectedBytes: number, actualBytes: number) => {
    const { mtimeMs: currentMtime } = await file.stat();
    if (currentMtime !== mtime) {
      throw new Error(
        "The history file was modified outside Allure. " +
          "Please, make sure the file doesn't change while Allure is running",
      );
    }

    throw new Error(
      `Can't read the history file: the expected number of bytes to read ${expectedBytes} ` +
        `doesn't match the actual number ${actualBytes}`,
    );
  };
}

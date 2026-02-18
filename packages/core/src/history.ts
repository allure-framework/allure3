import type { AllureHistory, HistoryDataPoint, HistoryTestResult, TestCase, TestResult } from "@allurereport/core-api";
import { once } from "node:events";
import { type FileHandle, mkdir, open } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { pipeline } from "node:stream/promises";
import { isFileNotFoundError } from "./utils/misc.js";

const createHistoryItems = (testResults: TestResult[]) => {
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
          url: "",
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

export const createHistory = (
  reportUuid: string,
  reportName: string = "Allure Report",
  testCases: TestCase[],
  testResults: TestResult[],
  remoteUrl: string = "",
): HistoryDataPoint => {
  const knownTestCaseIds = testCases.map((tc) => tc.id);

  return {
    uuid: reportUuid,
    name: reportName,
    timestamp: new Date().getTime(),
    knownTestCaseIds,
    testResults: createHistoryItems(testResults),
    metrics: {},
    url: remoteUrl,
  };
};

export class AllureLocalHistory implements AllureHistory {
  constructor(
    private readonly params: {
      historyPath: string;
      limit?: number;
    },
  ) {}

  async readHistory() {
    const fullPath = path.resolve(this.params.historyPath);

    const historyFile = await this.#openFileToReadIfExists(fullPath);
    if (historyFile === undefined) {
      return [];
    }

    try {
      const start = await this.#findFirstEntryAddress(historyFile, this.params.limit);
      const stream = historyFile.createReadStream({ start, encoding: "utf-8", autoClose: false });

      const historyPoints: HistoryDataPoint[] = [];
      const readlineInterface = readline
        .createInterface({ input: stream, terminal: false, crlfDelay: Infinity })
        .on("line", (line) => {
          if (line && line.trim().length) {
            const historyEntry = JSON.parse(line);
            historyPoints.push(historyEntry);
          }
        });

      await once(readlineInterface, "close");
      return historyPoints;
    } finally {
      await historyFile.close();
    }
  }

  async appendHistory(data: HistoryDataPoint) {
    const fullPath = path.resolve(this.params.historyPath);
    const parentDir = path.dirname(fullPath);
    const { limit } = this.params;

    await mkdir(parentDir, { recursive: true });

    const { file: historyFile, exists: historyExists } = await this.#ensureFileOpenedToAppend(fullPath);

    try {
      const dst = historyFile.createWriteStream({ encoding: "utf-8", start: 0, autoClose: false });

      if (limit !== 0) {
        if (historyExists) {
          // Move up to `limit-1` most recent entries to the beginning of the file
          const start = limit ? await this.#findFirstEntryAddress(historyFile, limit - 1) : 0;
          const src = historyFile.createReadStream({ start, autoClose: false });
          await pipeline(src, dst, { end: false });
        }

        // Append a new entry; the total number is up to `limit`.
        const sources = [JSON.stringify(data), Buffer.from([0x0a])];
        await pipeline(sources, dst);
      }

      if (historyExists) {
        await historyFile.truncate(dst.bytesWritten);
      }
    } finally {
      await historyFile.close();
    }
  }

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

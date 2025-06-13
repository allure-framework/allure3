import type { AllureHistory, HistoryDataPoint, HistoryTestResult, TestCase, TestResult } from "@allurereport/core-api";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { isFileNotFoundError } from "./utils/misc.js";

const createHistoryItems = (testResults: TestResult[]) => {
  return testResults
    .filter((tr) => tr.historyId)
    .map(({ id, name, fullName, historyId, status, error: { message, trace } = {}, start, stop, duration, labels }) => {
      return {
        id,
        name,
        fullName,
        status,
        message,
        trace,
        start,
        stop,
        duration,
        labels,
        historyId: historyId!,
        reportLinks: [],
      };
    })
    .reduce(
      (acc, item) => {
        acc[item.historyId] = {
          ...item,
          url: "",
        };

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

export const writeHistory = async (historyPath: string, data: HistoryDataPoint) => {
  const path = resolve(historyPath);
  const parentDir = dirname(path);
  await mkdir(parentDir, { recursive: true });
  await writeFile(path, `${JSON.stringify(data)}\n`, { encoding: "utf-8", flag: "a+" });
};

export class AllureLocalHistory implements AllureHistory {
  constructor(private readonly historyPath: string) {}

  async readHistory() {
    const path = resolve(this.historyPath);

    try {
      return (await readFile(path, { encoding: "utf-8" }))
        .split("\n")
        .filter((line) => line && line.trim() !== "")
        .map((line) => JSON.parse(line) as HistoryDataPoint);
    } catch (e) {
      if (isFileNotFoundError(e)) {
        return [];
      }
      throw e;
    }
  }

  async appendHistory(data: HistoryDataPoint) {
    const path = resolve(this.historyPath);
    const parentDir = dirname(path);

    await mkdir(parentDir, { recursive: true });
    await writeFile(path, `${JSON.stringify(data)}\n`, { encoding: "utf-8", flag: "a+" });
  }
}

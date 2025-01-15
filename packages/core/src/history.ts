import type { HistoryDataPoint, HistoryTestResult, TestCase, TestResult } from "@allurereport/core-api";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { isFileNotFoundError } from "./utils/misc.js";

const createHistoryItems = (testResults: TestResult[]) => {
  return testResults
    .filter((tr) => tr.historyId)
    .map(({ id, name, fullName, historyId, status, error: { message, trace } = {}, start, stop, duration }) => {
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
        historyId: historyId!,
        reportLinks: [],
      };
    })
    .reduce(
      (previousValue, currentValue) => {
        previousValue[currentValue.historyId] = currentValue;
        return previousValue;
      },
      {} as Record<string, HistoryTestResult>,
    );
};

export const createHistory = (
  reportUuid: string,
  reportName: string = "Allure Report",
  testCases: TestCase[],
  testResults: TestResult[],
): HistoryDataPoint => {
  const knownTestCaseIds = testCases.map((tc) => tc.id);

  return {
    uuid: reportUuid,
    name: reportName,
    timestamp: new Date().getTime(),
    knownTestCaseIds,
    testResults: createHistoryItems(testResults),
    metrics: {},
  };
};

export const readHistory = async (historyPath: string): Promise<HistoryDataPoint[]> => {
  const path = resolve(historyPath);
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
};

export const writeHistory = async (historyPath: string, data: HistoryDataPoint) => {
  const path = resolve(historyPath);
  const parentDir = dirname(path);
  await mkdir(parentDir, { recursive: true });
  await writeFile(path, `${JSON.stringify(data)}\n`, { encoding: "utf-8", flag: "a+" });
};

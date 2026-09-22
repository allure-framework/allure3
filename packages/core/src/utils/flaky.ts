import type { FlakyDetectionConfig, HistoryTestResult, TestResult, TestStatus } from "@allurereport/core-api";

const DEFAULT_HISTORY_DEPTH = 5;
const badStatuses: TestStatus[] = ["failed", "broken"];

const isAllureClassicFlaky = (tr: TestResult, history: HistoryTestResult[], historyDepth: number) => {
  if (history.length === 0 || !badStatuses.includes(tr.status)) {
    return false;
  }

  const limitedLastHistory = history.slice(0, historyDepth);
  const limitedLastHistoryStatuses = limitedLastHistory.map((h) => h.status);

  return (
    limitedLastHistoryStatuses.includes("passed") &&
    limitedLastHistoryStatuses.indexOf("passed") < limitedLastHistoryStatuses.lastIndexOf("failed")
  );
};

export const createFlakyDetector = ({
  historyDepth = DEFAULT_HISTORY_DEPTH,
  overrideFunction,
}: FlakyDetectionConfig = {}): ((tr: TestResult, history: HistoryTestResult[]) => boolean | Promise<boolean>) => {
  if (overrideFunction === undefined) {
    return (tr, history) => tr.flaky || isAllureClassicFlaky(tr, history, historyDepth);
  }

  return async (tr, history) => {
    const result = await overrideFunction(tr, history);

    if (typeof result !== "boolean") {
      throw new TypeError("flakyDetection.overrideFunction must return a boolean");
    }

    return result;
  };
};

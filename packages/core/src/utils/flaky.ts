import type { TestStatus, TestResult, HistoryTestResult } from "@allurereport/core-api";

const MAX_LAST_HISTORY_SIZE = 5;

const isAllureClassicFlaky = (tr: TestResult, history: HistoryTestResult[]) => {
    if (history.length === 0) {
        return false;
    }

    const nonFlakyStatuses: TestStatus[] = ["failed", "broken"];

    if (!nonFlakyStatuses.includes(tr.status)) {
        return false;
    }

    const limitedLastHistory = history.slice(-MAX_LAST_HISTORY_SIZE);
    const limitedLastHistoryStatuses = limitedLastHistory.map((h) => h.status);

    return limitedLastHistoryStatuses.includes("passed")
    && limitedLastHistoryStatuses.indexOf("passed") < limitedLastHistoryStatuses.lastIndexOf("failed");
};

export const isFlaky = (tr: TestResult, history: HistoryTestResult[]) => tr.flaky || isAllureClassicFlaky(tr, history);

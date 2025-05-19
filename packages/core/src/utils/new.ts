import type { HistoryTestResult, TestResult, MeaningfulTestStatus } from "@allurereport/core-api";

const NON_MEANINGFUL_HISTORY_STATUSES = ["unknown", "skipped"];

export const isNew = (history: HistoryTestResult[] = []) => history.length === 0;

const getMeaningfulHistory = (history: HistoryTestResult[] = []): HistoryTestResult[] => history.filter((htr) => !NON_MEANINGFUL_HISTORY_STATUSES.includes(htr.status));

/**
 * @description Checks if the test result is switched to another meaningful status.
 * @param tr - The test result to check.
 * @param history - The history of test results.
 * @returns `true` if the test result is switched to a new status, `false` otherwise.
 */
export const isHistoricallyNew = (tr: TestResult, history: HistoryTestResult[] = []) => {
    const meaningfulHistory = getMeaningfulHistory(history);

    // If status is only current on the test result, it is new.
    if (meaningfulHistory.length === 0) {
        return true;
    }

    return meaningfulHistory[meaningfulHistory.length - 1].status !== tr.status;
};

export const isNewPassed = (tr: TestResult, history: HistoryTestResult[] = []) => isHistoricallyNew(tr, history) && tr.status === "passed";

export const isNewFailed = (tr: TestResult, history: HistoryTestResult[] = []) => isHistoricallyNew(tr, history) && tr.status === "failed";

export const isNewBroken = (tr: TestResult, history: HistoryTestResult[] = []) => isHistoricallyNew(tr, history) && tr.status === "broken";

export const getLastMeaningfulTestStatus = (tr: TestResult, history: HistoryTestResult[] = []): MeaningfulTestStatus | undefined => {
    const meaningfulHistory = getMeaningfulHistory(history);

    if (meaningfulHistory.length === 0) {
        return undefined;
    }

    const previousMeaningfulHistoryTestResult = meaningfulHistory[meaningfulHistory.length - 1];

    if (isHistoricallyNew(tr, meaningfulHistory)) {
        return previousMeaningfulHistoryTestResult.status as MeaningfulTestStatus;
    }
};

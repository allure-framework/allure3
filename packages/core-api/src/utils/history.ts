import type { HistoryDataPoint, HistoryTestResult } from "../history.js";
import type { TestResult } from "../model.js";

/**
 * @description Gets the historical test results for the test result.
 * @param hdps - The history data points.
 * @param tr - The test result or history test result.
 * @returns The history test results array.
 */
export const htrsByTr = (hdps: HistoryDataPoint[], tr: TestResult | HistoryTestResult): HistoryTestResult[] => {
  if (!tr?.historyId) {
    return [];
  }

  return hdps.reduce((acc, dp) => {
    const htr = dp.testResults[tr.historyId!];

    if (htr) {
      if (dp.url) {
        const url = new URL(dp.url);

        url.hash = tr.id;

        acc.push({
          ...htr,
          url: url.toString(),
        });
      } else {
        acc.push(htr);
      }
    }

    return acc;
  }, [] as HistoryTestResult[]);
};

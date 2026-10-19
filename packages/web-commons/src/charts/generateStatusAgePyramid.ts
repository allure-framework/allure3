import type {
  AllureChartsStoreData,
  StatusAgePyramidChartData,
  StatusAgePyramidChartOptions,
} from "@allurereport/charts-api";
import { ChartType, DEFAULT_CHART_HISTORY_LIMIT } from "@allurereport/charts-api";
import { createHistoryTestResultLookup, type TestStatus } from "@allurereport/core-api";

import { limitHistoryDataPoints } from "./chart-utils.js";

type DataItem = StatusAgePyramidChartData["data"][number];

type FBSUStatus = Exclude<TestStatus, "passed">;

const createEmptyStats = (): Omit<DataItem, "id" | "timestamp"> => {
  return STATUSES.reduce(
    (acc, status) => {
      acc[status] = 0;
      return acc;
    },
    {} as Omit<DataItem, "id" | "timestamp">,
  );
};

const STATUSES: FBSUStatus[] = ["failed", "broken", "skipped", "unknown"];

const isFBSUStatus = (status: TestStatus): status is FBSUStatus => STATUSES.includes(status as FBSUStatus);

export const generateStatusAgePyramid = (props: {
  options: StatusAgePyramidChartOptions;
  storeData: AllureChartsStoreData;
}): StatusAgePyramidChartData => {
  const { options, storeData } = props;
  const { limit = DEFAULT_CHART_HISTORY_LIMIT } = options;
  const { historyDataPoints, testResults } = storeData;
  const lookupHistoryTestResult = createHistoryTestResultLookup(storeData.allTestResults ?? testResults);
  const currentReportTimestamp = testResults.reduce((acc, testResult) => Math.max(acc, testResult.stop ?? 0), 0);
  const limitedHistoryPoints = limitHistoryDataPoints(historyDataPoints, limit).sort(
    // Sort by timestamp ascending, so earliest first and latest last
    (a, b) => a.timestamp - b.timestamp,
  );

  if (limitedHistoryPoints.length === 0) {
    return {
      type: ChartType.StatusAgePyramid,
      title: options.title,
      data: [
        {
          id: "current",
          timestamp: currentReportTimestamp,
          ...createEmptyStats(),
        },
      ],
      statuses: STATUSES,
    };
  }

  const data: DataItem[] = limitedHistoryPoints.map((historyDataPoint, index) => {
    const stats = createEmptyStats();

    for (const testResult of testResults) {
      const historicalTestResult = lookupHistoryTestResult(historyDataPoint, testResult);

      if (!historicalTestResult) {
        continue;
      }

      const currentTrStatus = historicalTestResult.status;

      // Skip non-FBSU status tests
      if (!isFBSUStatus(currentTrStatus)) {
        continue;
      }

      const historyAfterTrsStatuses: (TestStatus | undefined)[] = limitedHistoryPoints
        .slice(index)
        .map((historyAfterPoint) => lookupHistoryTestResult(historyAfterPoint, testResult)?.status);

      // If the test status changed in a later run, skip it
      if (historyAfterTrsStatuses.some((status) => status !== currentTrStatus)) {
        continue;
      }

      stats[currentTrStatus]++;
    }

    return {
      id: historyDataPoint.uuid,
      timestamp: historyDataPoint.timestamp,
      failed: stats.failed,
      broken: stats.broken,
      skipped: stats.skipped,
      unknown: stats.unknown,
    };
  });
  const currentStats = createEmptyStats();

  for (const testResult of testResults) {
    if (isFBSUStatus(testResult.status)) {
      currentStats[testResult.status]++;
    }
  }

  data.push({
    id: "current",
    timestamp: currentReportTimestamp,
    failed: currentStats.failed,
    broken: currentStats.broken,
    skipped: currentStats.skipped,
    unknown: currentStats.unknown,
  });

  return {
    type: ChartType.StatusAgePyramid,
    title: options.title,
    data: data,
    statuses: STATUSES,
  };
};

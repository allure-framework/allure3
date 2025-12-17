import type {
  AllureChartsStoreData,
  DurationDynamicsChartData,
  DurationDynamicsChartOptions,
} from "@allurereport/charts-api";
import { ChartType, DEFAULT_CHART_HISTORY_LIMIT } from "@allurereport/charts-api";
import type { TestResult } from "@allurereport/core-api";
import { limitHistoryDataPoints } from "./chart-utils.js";

const getStats = (testResults: TestResult[]) => {
  const stats = {
    duration: 0,
    sequentialDuration: 0,
    speedup: 0,
  };

  if (testResults.length === 0) {
    return stats;
  }

  // Collect intervals and calculate sequential duration (sum of all individual durations)
  const intervals: [number, number][] = [];

  for (const tr of testResults) {
    const testStart = tr.start ?? 0;
    const testStop = tr.stop ?? 0;
    const testDuration = Math.max(0, testStop - testStart);

    stats.sequentialDuration += testDuration;

    if (testDuration > 0) {
      intervals.push([testStart, testStop]);
    }
  }

  // Sort intervals by start time
  intervals.sort((a, b) => a[0] - b[0]);

  // Merge overlapping intervals and calculate total duration
  if (intervals.length > 0) {
    let [mergedStart, mergedEnd] = intervals[0];

    for (let i = 1; i < intervals.length; i++) {
      const [start, end] = intervals[i];

      if (start <= mergedEnd) {
        // Intervals overlap or touch - extend the current merged interval
        mergedEnd = Math.max(mergedEnd, end);
      } else {
        // No overlap - add duration of previous merged interval and start new one
        stats.duration += mergedEnd - mergedStart;
        mergedStart = start;
        mergedEnd = end;
      }
    }

    // Add the last merged interval
    stats.duration += mergedEnd - mergedStart;
  }

  // Calculate speedup coefficient (how many times faster due to parallelization)
  if (stats.duration > 0) {
    stats.speedup = Math.round((stats.sequentialDuration / stats.duration) * 100) / 100;
  }

  return stats;
};

export const generateDurationDynamicsChart = (props: {
  options: DurationDynamicsChartOptions;
  storeData: AllureChartsStoreData;
}): DurationDynamicsChartData => {
  const { options, storeData } = props;
  const { title, limit = DEFAULT_CHART_HISTORY_LIMIT } = options;

  const { historyDataPoints, testResults } = storeData;

  const limitedHistoryPoints = limitHistoryDataPoints(historyDataPoints, limit - 1).sort(
    // Sort by timestamp ascending, so earliest first and latest last
    (a, b) => a.timestamp - b.timestamp,
  );

  const currentReportTimestamp = testResults.reduce((acc, testResult) => Math.max(acc, testResult.stop ?? 0), 0);

  if (limitedHistoryPoints.length === 0) {
    return {
      type: ChartType.DurationDynamics,
      title,
      data: [
        {
          id: "current",
          timestamp: currentReportTimestamp,
          ...getStats(testResults),
        },
      ],
    };
  }

  const data = [
    ...limitedHistoryPoints,
    {
      testResults: testResults.reduce(
        (acc, testResult) => {
          acc[testResult.historyId ?? testResult.id] = testResult;
          return acc;
        },
        {} as Record<string, TestResult>,
      ),
      uuid: "current",
      timestamp: currentReportTimestamp,
      stats: getStats(testResults),
    },
  ].map((point) => ({
    id: point.uuid,
    timestamp: point.timestamp,
    ...getStats(Object.values(point.testResults)),
  }));

  return {
    data,
    type: ChartType.DurationDynamics,
    title,
  };
};

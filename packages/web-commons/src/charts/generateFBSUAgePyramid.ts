import type {
  AllureChartsStoreData,
  FBSUAgePyramidChartData,
  FBSUAgePyramidChartOptions,
} from "@allurereport/charts-api";
import { ChartType, DEFAULT_CHART_HISTORY_LIMIT } from "@allurereport/charts-api";
import type { HistoryTestResult, TestResult, TestStatus } from "@allurereport/core-api";
import { limitHistoryDataPoints } from "./chart-utils.js";

type DataItem = FBSUAgePyramidChartData["data"][number];

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

export const generateFBSUAgePyramid = (props: {
  options: FBSUAgePyramidChartOptions;
  storeData: AllureChartsStoreData;
}): FBSUAgePyramidChartData => {
  const { options, storeData } = props;
  const { limit = DEFAULT_CHART_HISTORY_LIMIT } = options;
  const { historyDataPoints, testResults } = storeData;

  const currentReportTimestamp = testResults.reduce((acc, testResult) => Math.max(acc, testResult.stop ?? 0), 0);

  const limitedHistoryPoints = limitHistoryDataPoints(historyDataPoints, limit).sort(
    // Sort by timestamp ascending, so earliest first and latest last
    (a, b) => a.timestamp - b.timestamp,
  );

  if (limitedHistoryPoints.length === 0) {
    return {
      type: ChartType.FBSUAgePyramid,
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
  const hdps = limitedHistoryPoints.map((datapoint) => ({
    ...datapoint,
    testResults: Object.values(datapoint.testResults).reduce(
      (acc, testResult) => {
        if (!testResult.historyId) {
          return acc;
        }

        const isInCurrentRun = testResults.findIndex((tr) => tr.historyId === testResult.historyId) !== -1;

        if (isInCurrentRun) {
          acc[testResult.historyId] = testResult;
        }

        return acc;
      },
      {} as Record<string, HistoryTestResult>,
    ),
  }));

  const dataPoints = [
    ...hdps.map((hdp) => ({
      ...hdp,
      ...createEmptyStats(),
    })),
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
      ...createEmptyStats(),
    },
  ];

  dataPoints.forEach((dp, index, dps) => {
    const { testResults: trs } = dp;
    const historyAfter = dps.slice(index, dps.length - 1);

    const currentTrs: (TestResult | HistoryTestResult)[] = Object.values(trs);

    for (const cTr of currentTrs) {
      const currentTrStatus = cTr.status;

      if (!isFBSUStatus(currentTrStatus)) {
        continue;
      }

      const historyAfterTrsStatuses: (TestStatus | undefined)[] = historyAfter.map(
        (hdp) => hdp.testResults[cTr.historyId!]?.status ?? undefined,
      );

      if (historyAfterTrsStatuses.some((status) => status !== currentTrStatus)) {
        continue;
      }

      dp[currentTrStatus]++;
    }
  });

  const data: DataItem[] = dataPoints.map(({ uuid, timestamp, ...stats }) => ({
    id: uuid,
    timestamp,
    failed: stats.failed ?? 0,
    broken: stats.broken ?? 0,
    skipped: stats.skipped ?? 0,
    unknown: stats.unknown ?? 0,
  }));

  return {
    type: ChartType.FBSUAgePyramid,
    title: options.title,
    data: data,
    statuses: STATUSES,
  };
};

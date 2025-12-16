import type {
  AllureChartsStoreData,
  FBSUAgePyramidChartData,
  FBSUAgePyramidChartOptions,
} from "@allurereport/charts-api";
import { ChartType, DEFAULT_CHART_HISTORY_LIMIT } from "@allurereport/charts-api";
import type { HistoryDataPoint, HistoryTestResult, TestResult, TestStatus } from "@allurereport/core-api";
import { htrsByTr } from "@allurereport/core-api";
import { limitHistoryDataPoints } from "./chart-utils.js";

type DataItem = FBSUAgePyramidChartData["data"][number];

type FBSUStatus = Exclude<TestStatus, "passed">;

const createEmptyStats = (statuses: FBSUStatus[]): Omit<DataItem, "id" | "timestamp"> => {
  return statuses.reduce(
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

  const [earliestHdp, ...hdps] = limitedHistoryPoints;

  const dataPoints = [
    ...hdps.map((hdp) => ({
      ...hdp,
      ...createEmptyStats(STATUSES),
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
      ...createEmptyStats(STATUSES),
    },
  ];

  // @TODO: Add accumulation later
  dataPoints.forEach((dp, index, dataPointsAscending) => {
    const { testResults: trs } = dp;
    const isFirst = index === 0;
    // Add earliest history point to the beginning of the array if it's the first data point
    const hpsPriorToCurrent = isFirst ? [earliestHdp] : dataPointsAscending.slice(0, index);

    const currentTrs: (TestResult | HistoryTestResult)[] = Object.values(trs);

    for (const cTr of currentTrs) {
      // Skip test results with statuses that are not in the status list from chart options
      if (!isFBSUStatus(cTr.status)) {
        continue;
      }

      // Compare only to latest history point, as we don't know the previous history
      const htrsPriortoCurr = htrsByTr(hpsPriorToCurrent as HistoryDataPoint[], cTr);

      // Test result is new, because it has no history
      if (htrsPriortoCurr.length === 0) {
        dp[cTr.status]++;
      }
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

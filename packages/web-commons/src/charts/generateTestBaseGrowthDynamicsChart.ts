import type {
  AllureChartsStoreData,
  TestBaseGrowthDynamicsChartData,
  TestBaseGrowthDynamicsChartOptions,
} from "@allurereport/charts-api";
import { ChartType, DEFAULT_CHART_HISTORY_LIMIT } from "@allurereport/charts-api";
import type { HistoryDataPoint, HistoryTestResult, TestResult, TestStatus } from "@allurereport/core-api";
import { htrsByTr, statusesList } from "@allurereport/core-api";
import { limitHistoryDataPoints } from "./chart-utils.js";

type DataItem = TestBaseGrowthDynamicsChartData["data"][number];

const createEmptyStats = (statuses: TestStatus[]): Omit<DataItem, "id" | "timestamp"> => {
  return statuses.reduce(
    (acc, status) => {
      acc[`new:${status}`] = 0;
      acc[`removed:${status}`] = 0;
      return acc;
    },
    {} as Omit<DataItem, "id" | "timestamp">,
  );
};

const DEFAULT_STATUSES = [...statusesList];

export const generateTestBaseGrowthDynamicsChart = (props: {
  options: TestBaseGrowthDynamicsChartOptions;
  storeData: AllureChartsStoreData;
}): TestBaseGrowthDynamicsChartData => {
  const { options, storeData } = props;
  const { limit = DEFAULT_CHART_HISTORY_LIMIT, statuses = DEFAULT_STATUSES } = options;
  const { historyDataPoints, testResults } = storeData;

  const currentReportTimestamp = testResults.reduce((acc, testResult) => Math.max(acc, testResult.stop ?? 0), 0);
  const statusList = statuses.length > 0 ? statuses : DEFAULT_STATUSES;

  const limitedHistoryPoints = limitHistoryDataPoints(historyDataPoints, limit).sort(
    // Sort by timestamp ascending, so earliest first and latest last
    (a, b) => a.timestamp - b.timestamp,
  );

  const [earliestHdp, ...hdps] = limitedHistoryPoints;

  const dataPoints = [
    ...hdps.map((hdp) => ({
      ...hdp,
      stats: createEmptyStats(statusList),
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
      stats: createEmptyStats(statusList),
    },
  ];

  dataPoints.forEach(({ testResults: trs, stats }, index, dataPointsAscending) => {
    const isFirst = index === 0;
    const isLast = index === dataPointsAscending.length - 1;
    // Add earliest history point to the beginning of the array if it's the first data point
    const hpsPriorToCurrent = isFirst ? [earliestHdp] : dataPointsAscending.slice(0, index);
    const hpsAfterCurrent = isLast ? [] : dataPointsAscending.slice(index + 1);

    const currentTrs: (TestResult | HistoryTestResult)[] = Object.values(trs);

    for (const cTr of currentTrs) {
      // Skip test results with statuses that are not in the status list from chart options
      if (!statusList.includes(cTr.status)) {
        continue;
      }

      // Compare only to latest history point, as we don't know the previous history
      const htrsPriortoCurr = htrsByTr(hpsPriorToCurrent as HistoryDataPoint[], cTr);
      const htrsAfterCurrent = htrsByTr(hpsAfterCurrent as HistoryDataPoint[], cTr);

      // Test result is new, because it has no history
      if (htrsPriortoCurr.length === 0) {
        stats[`new:${cTr.status}`]++;
      }

      if (htrsAfterCurrent.length === 0 && !isLast) {
        stats[`removed:${cTr.status}`]++;
      }
    }
  });

  const data: DataItem[] = dataPoints.map(({ uuid, timestamp, stats }) => ({ ...stats, id: uuid, timestamp }));

  return {
    type: ChartType.TestBaseGrowthDynamics,
    title: options.title,
    data: data,
    statuses: statusList,
  };
};

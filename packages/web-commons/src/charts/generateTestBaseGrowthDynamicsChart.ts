import type {
  AllureChartsStoreData,
  TestBaseGrowthDynamicsChartData,
  TestBaseGrowthDynamicsChartOptions,
} from "@allurereport/charts-api";
import { ChartType, DEFAULT_CHART_HISTORY_LIMIT } from "@allurereport/charts-api";
import {
  createHistoryTestResultLookup,
  statusesList,
  type HistoryTestResult,
  type TestResult,
  type TestStatus,
} from "@allurereport/core-api";

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
  const lookupHistoryTestResult = createHistoryTestResultLookup(storeData.allTestResults ?? testResults);

  const currentReportTimestamp = testResults.reduce((acc, testResult) => Math.max(acc, testResult.stop ?? 0), 0);
  const statusList = statuses.length > 0 ? statuses : DEFAULT_STATUSES;

  const limitedHistoryPoints = limitHistoryDataPoints(historyDataPoints, limit).sort(
    // Sort by timestamp ascending, so earliest first and latest last
    (a, b) => a.timestamp - b.timestamp,
  );

  if (limitedHistoryPoints.length === 0) {
    return {
      type: ChartType.TestBaseGrowthDynamics,
      title: options.title,
      data: [
        {
          id: "current",
          timestamp: currentReportTimestamp,
          ...createEmptyStats(statusList),
        },
      ],
      statuses: statusList,
    };
  }

  const dataPoints = [
    ...limitedHistoryPoints.map((hdp) => ({
      ...hdp,
      stats: createEmptyStats(statusList),
    })),
    {
      testResults: testResults.reduce(
        (acc, testResult) => {
          acc[testResult.retryHash ?? testResult.id] = testResult;
          return acc;
        },
        {} as Record<string, TestResult>,
      ),
      uuid: "current",
      timestamp: currentReportTimestamp,
      stats: createEmptyStats(statusList),
    },
  ];

  dataPoints.forEach(({ testResults: trs, stats }, index) => {
    const hpsPriorToCurrent = dataPoints.slice(0, index);
    const hpsAfterCurrent = dataPoints.slice(index + 1);
    const nextStats = dataPoints[index + 1]?.stats;

    const currentTrs: (TestResult | HistoryTestResult)[] = Object.values(trs).filter((tr) => {
      const selected = lookupHistoryTestResult<TestResult | HistoryTestResult>({ testResults: trs }, tr);
      return !selected || selected === tr;
    });

    for (const cTr of currentTrs) {
      // Skip test results with statuses that are not in the status list from chart options
      if (!statusList.includes(cTr.status)) {
        continue;
      }

      // The baseline participates in matching but is not a displayed comparison.
      if (
        index > 0 &&
        !hpsPriorToCurrent.some((hdp) => lookupHistoryTestResult<TestResult | HistoryTestResult>(hdp, cTr))
      ) {
        stats[`new:${cTr.status}`]++;
      }

      // Attribute a final disappearance to the next run, where absence is first observed.
      if (
        nextStats &&
        !hpsAfterCurrent.some((hdp) => lookupHistoryTestResult<TestResult | HistoryTestResult>(hdp, cTr))
      ) {
        nextStats[`removed:${cTr.status}`]++;
      }
    }
  });

  const data: DataItem[] = dataPoints.slice(1).map(({ uuid, timestamp, stats }) => ({ ...stats, id: uuid, timestamp }));

  return {
    type: ChartType.TestBaseGrowthDynamics,
    title: options.title,
    data: data,
    statuses: statusList,
  };
};

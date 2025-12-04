import type { AllureChartsStoreData, StatusDynamicsChartOptions } from "@allurereport/charts-api";
import { ChartType, DEFAULT_CHART_HISTORY_LIMIT } from "@allurereport/charts-api";
import type { Statistic } from "@allurereport/core-api";
import { emptyStatistic, incrementStatistic, statusesList } from "@allurereport/core-api";
import { limitHistoryDataPoints } from "./chart-utils.js";
import type { StatusDynamicsChartData } from "./types.js";

export const generateStatusDynamicsChart = (props: {
  options: StatusDynamicsChartOptions;
  storeData: AllureChartsStoreData;
}): StatusDynamicsChartData => {
  const { options, storeData } = props;
  const { limit = DEFAULT_CHART_HISTORY_LIMIT, statuses = statusesList } = options;
  const { historyDataPoints, testResults } = storeData;

  const limitMinusCurrent = limit > 1 ? limit - 1 : limit;

  const limitedHistoryPoints = limitHistoryDataPoints(historyDataPoints, limitMinusCurrent).sort(
    // Sort by timestamp ascending, so earliest first and latest last
    (a, b) => a.timestamp - b.timestamp,
  );

  const latestStop = testResults.reduce((acc, testResult) => Math.max(acc, testResult.stop ?? 0), 0);

  const historyData = limitedHistoryPoints.map((point) => {
    const statistic = emptyStatistic();
    for (const testResult of Object.values(point.testResults)) {
      incrementStatistic(statistic, testResult.status);
    }
    return {
      name: point.name,
      statistic: statuses.reduce(
        (acc, status) => {
          acc[status] = statistic[status];
          return acc;
        },
        { total: statistic.total } as Statistic,
      ),
      id: point.uuid,
      timestamp: point.timestamp,
    };
  });

  // Filter current statistic to only include selected statuses, matching history data structure
  const currentStatistic = statuses.reduce(
    (acc, status) => {
      acc[status] = storeData.statistic[status];
      return acc;
    },
    { total: storeData.statistic.total } as Statistic,
  );

  return {
    type: ChartType.StatusDynamics,
    title: options.title,
    data: [...historyData, { statistic: currentStatistic, id: "current", timestamp: latestStop, name: "current" }],
    statuses: options.statuses,
  };
};

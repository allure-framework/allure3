import type { TrendDataAccessor, TrendStats } from "@allurereport/charts-api";
import type { TestStatus } from "@allurereport/core-api";
import { statusesList } from "@allurereport/core-api";
import { createEmptyStats } from "../chart-utils.js";

type StatusTrendStats = TrendStats<TestStatus>;

export const statusTrendDataAccessor: TrendDataAccessor<TestStatus> = {
  getCurrentData: ({ statistic }) => {
    return {
      ...createEmptyStats(statusesList),
      ...statistic,
    };
  },
  getHistoricalData: (historyPoint) => {
    return Object.values(historyPoint.testResults).reduce((stat: StatusTrendStats, test) => {
      if (test.status) {
        stat[test.status] = (stat[test.status] ?? 0) + 1;
      }

      return stat;
    }, createEmptyStats(statusesList));
  },
  getAllValues: () => statusesList,
};

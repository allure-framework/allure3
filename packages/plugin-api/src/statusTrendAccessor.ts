import type { HistoryDataPoint, TestStatus } from "@allurereport/core-api";
import { statusesList } from "@allurereport/core-api";
import type { TrendDataAccessor, TrendStats } from "./charts.js";
import { createEmptyStats } from "./charts.js";
import type { AllureStore } from "./store.js";

type StatusTrendStats = TrendStats<TestStatus>;

export const statusTrendDataAccessor: TrendDataAccessor<TestStatus> = {
  getCurrentData: async (store: AllureStore): Promise<StatusTrendStats> => {
    const statistic = await store.testsStatistic();
    return {
      ...createEmptyStats(statusesList),
      ...statistic,
    };
  },
  getHistoricalData: (historyPoint: HistoryDataPoint): StatusTrendStats => {
    return Object.values(historyPoint.testResults).reduce((stat: StatusTrendStats, test) => {
      if (test.status) {
        stat[test.status] = (stat[test.status] ?? 0) + 1;
      }

      return stat;
    }, createEmptyStats(statusesList));
  },
  getAllValues: () => statusesList,
};

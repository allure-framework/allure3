import type { HistoryDataPoint, TestStatus, BarGroup, Statistic } from "@allurereport/core-api";
import { BarGroupMode, statusesList } from "@allurereport/core-api";
import { type BarDataAccessor, createEmptyStats } from "./charts.js";

type TrendKey = "passed" | "failed" | "broken";

const getSignedValueByStatus = (status: TestStatus): number => status === "passed" ? 1 : -1;

const getSignedValuesByStatus = (stats: Omit<Statistic, "total">, groupId: string): BarGroup<string, TrendKey> => Object.entries(stats).reduce((acc, [status, value]) => {
    acc[status as TrendKey] = value * getSignedValueByStatus(status as TrendKey);

    return acc;
}, { groupId } as BarGroup<string, TrendKey>);

const calculateTrendData = (historyPoints: HistoryDataPoint[]): BarGroup<string, TrendKey>[] => historyPoints.reduce((trendData, point, index) => {
    const stats = Object.values(point.testResults).reduce((acc, test) => {
        if (test.status) {
            acc[test.status] = (acc[test.status] ?? 0) + 1;
        }

        return acc;
    }, createEmptyStats(statusesList));

    trendData.push(getSignedValuesByStatus(stats, `Point ${index + 1}`));

    return trendData;
}, [] as BarGroup<string, TrendKey>[]);

export const statusTrendBarAccessor: BarDataAccessor<string, TrendKey> = {
  getItems: async (store, historyPoints) => {
    const stats = await store.testsStatistic();
    const limitedHistoryPoints = historyPoints.slice(0, -1);

    return [
      ...calculateTrendData(limitedHistoryPoints),
      getSignedValuesByStatus(stats, "current")
    ];
  },
  getGroupKeys: () => ["passed", "failed", "broken"],
  getGroupMode: () => BarGroupMode.Stacked,
};



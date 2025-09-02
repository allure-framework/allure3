import type { BarGroup, HistoryDataPoint, HistoryTestResult, TestResult, TestStatus } from "@allurereport/core-api";
import { BarGroupMode, htrsByTr } from "@allurereport/core-api";
import { type BarDataAccessor, createEmptyStats } from "./charts.js";

type TrendKey = Extract<TestStatus, "passed" | "failed" | "broken">;
type TrendStats = Record<TrendKey, number>;

const groupKeys = ["passed", "failed", "broken"] as const;

const isGroupKey = (key: string): key is TrendKey => groupKeys.includes(key as TrendKey);

const getSignedValueByStatus = (status: TestStatus): number => (status === "passed" ? 1 : -1);

const hasSignificantStatus = (htr: HistoryTestResult): boolean => isGroupKey(htr.status);

const getLastSignificantStatus = (history: HistoryTestResult[] = []): TestStatus | undefined => {
  const significantHtr = history.find(hasSignificantStatus);

  return significantHtr?.status;
};

const isDifferentStatuses = (currentStatus: TestStatus, lastSignificantStatus?: TestStatus): boolean => {
  return (
    !!lastSignificantStatus &&
    isGroupKey(currentStatus) &&
    isGroupKey(lastSignificantStatus) &&
    currentStatus !== lastSignificantStatus
  );
};

const getPointStats = (currentTrs: (TestResult | HistoryTestResult)[], hdps: HistoryDataPoint[]): TrendStats => {
  const stats = createEmptyStats(groupKeys);

  for (const tr of currentTrs) {
    const htrs = htrsByTr(hdps, tr);

    const currentStatus = tr.status as TrendKey;
    const lastSignificantStatus = getLastSignificantStatus(htrs);

    if (isDifferentStatuses(currentStatus, lastSignificantStatus)) {
      stats[currentStatus] = stats[currentStatus] + getSignedValueByStatus(currentStatus);
    }
  }

  return stats;
};

const getCurrentStats = (testResults: TestResult[], hdps: HistoryDataPoint[]): BarGroup<string, TrendKey> => {
  return {
    groupId: "current",
    ...getPointStats(testResults, hdps),
  };
};

const getHistoricalStats = (hdps: HistoryDataPoint[]): BarGroup<string, TrendKey>[] => {
  const trendData: BarGroup<string, TrendKey>[] = [];

  for (let i = 0; i < hdps.length; i++) {
    const currentHdp = hdps[i];
    const currentHdpTrs = Object.values(currentHdp.testResults);
    const restHdps = i + 1 < hdps.length ? hdps.slice(i + 1, hdps.length) : [];

    trendData.push({
      groupId: `Point ${hdps.length - i - 1}`,
      ...getPointStats(currentHdpTrs, restHdps),
    });
  }

  return trendData;
};

const getTrendData = (currentTrs: TestResult[], hdps: HistoryDataPoint[]): BarGroup<string, TrendKey>[] => {
  const historicalStats = getHistoricalStats(hdps);
  const currentStats = getCurrentStats(currentTrs, hdps);

  return [currentStats, ...historicalStats];
};

export const statusTrendBarAccessor: BarDataAccessor<string, TrendKey> = {
  getItems: ({ testResults }, limitedHdps, isFullHistory) => {
    let trendData = getTrendData(testResults, limitedHdps);

    /* This is necessary not to exclude the last point that have been compared with the empty stats if the history is fully provided.
     *
     * We have no previous poin in the end of the full history, that's why we have to compare it with the empty stats.
     * At the opposite, we have to exclude the last point if the history is limited because it should be compared with the real previous point,
     * but it is already excluded in limited history.
     */
    if (!isFullHistory) {
      trendData = trendData.slice(0, -1);
    }

    return trendData.reverse();
  },
  getGroupKeys: () => groupKeys,
  getGroupMode: () => BarGroupMode.Stacked,
};

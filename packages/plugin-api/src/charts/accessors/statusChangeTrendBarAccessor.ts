import type {
  BarGroup,
  HistoryDataPoint,
  HistoryTestResult,
  NewKey,
  RemovedKey,
  TestResult,
  TestStatus,
} from "@allurereport/core-api";
import { BarGroupMode, capitalize } from "@allurereport/core-api";
import { type BarDataAccessor, createEmptyStats } from "../../charts.js";

// Types for new statuses trend chart data
export type StatusChangeTrendKeys = NewKey<TestStatus> | RemovedKey<TestStatus>;

const newGroupKeys = ["newPassed", "newFailed", "newBroken", "newSkipped", "newUnknown"] as const;
const removedGroupKeys = [
  "removedPassed",
  "removedFailed",
  "removedBroken",
  "removedSkipped",
  "removedUnknown",
] as const;
const groupKeys = [...newGroupKeys, ...removedGroupKeys] as const;

const getNewKey = (status: TestStatus): StatusChangeTrendKeys | undefined => {
  const capitalizedStatus = capitalize(status);

  return capitalizedStatus ? `new${capitalizedStatus}` : undefined;
};

const getRemovedKey = (status: TestStatus): StatusChangeTrendKeys | undefined => {
  const capitalizedStatus = capitalize(status);

  return capitalizedStatus ? `removed${capitalizedStatus}` : undefined;
};

const isHistoryIdIn = (trs: (TestResult | HistoryTestResult)[], historyId: string) => {
  return trs.some((tr) => tr.historyId === historyId);
};

const getDeletedFrom = (trs: (TestResult | HistoryTestResult)[], hdpTrs: HistoryTestResult[]) => {
  const stats = createEmptyStats(groupKeys);

  for (const hdpTr of hdpTrs) {
    if (!isHistoryIdIn(trs, hdpTr.historyId!)) {
      const key = getRemovedKey(hdpTr.status);
      if (key) {
        stats[key]--;
      }
    }
  }

  return stats;
};

const getNewFrom = (trs: (TestResult | HistoryTestResult)[], hdpTrs: HistoryTestResult[]) => {
  const stats = createEmptyStats(groupKeys);

  for (const tr of trs) {
    if (!isHistoryIdIn(hdpTrs, tr.historyId!)) {
      const key = getNewKey(tr.status);
      if (key) {
        stats[key]++;
      }
    }
  }

  return stats;
};

const getPointStats = (
  currentTrs: (TestResult | HistoryTestResult)[],
  hdpTrs: HistoryTestResult[],
): Record<StatusChangeTrendKeys, number> => {
  const emptyStats = createEmptyStats(groupKeys);
  const newStats = getNewFrom(currentTrs, hdpTrs);
  const deletedStats = getDeletedFrom(currentTrs, hdpTrs);

  return Object.keys(emptyStats).reduce(
    (acc, key) => {
      const newStat = newStats[key as StatusChangeTrendKeys] ?? 0;
      const deletedStat = deletedStats[key as StatusChangeTrendKeys] ?? 0;

      acc[key as StatusChangeTrendKeys] = newStat + deletedStat;

      return acc;
    },
    {} as Record<StatusChangeTrendKeys, number>,
  );
};

const getCurrentStats = (
  testResults: TestResult[],
  hdpTrs: HistoryTestResult[],
): BarGroup<string, StatusChangeTrendKeys> => {
  return {
    groupId: "current",
    ...getPointStats(testResults, hdpTrs),
  };
};

const getHistoricalStats = (hdps: HistoryDataPoint[]): BarGroup<string, StatusChangeTrendKeys>[] => {
  const trendData: BarGroup<string, StatusChangeTrendKeys>[] = [];

  for (let i = 0; i < hdps.length; i++) {
    const currentHdp = hdps[i];
    const currentHdpTrs = Object.values(currentHdp.testResults);
    const previousHdpTrs = i + 1 < hdps.length ? Object.values(hdps[i + 1].testResults) : [];

    trendData.push({
      groupId: `Point ${hdps.length - i - 1}`,
      ...getPointStats(currentHdpTrs, previousHdpTrs),
    });
  }

  return trendData;
};

const getTrendData = (
  currentTrs: TestResult[],
  hdps: HistoryDataPoint[],
): BarGroup<string, StatusChangeTrendKeys>[] => {
  const historicalStats = getHistoricalStats(hdps);
  const currentStats = getCurrentStats(currentTrs, Object.values(hdps[0].testResults));

  return [currentStats, ...historicalStats];
};

export const statusChangeTrendBarAccessor: BarDataAccessor<string, StatusChangeTrendKeys> = {
  getItems: ({ testResults }, limitedHdps, isFullHistory) => {
    let trendData = getTrendData(testResults, limitedHdps);

    /* This is necessary not to exclude the last point that have been compared with the empty stats if the history is fully provided.
     *
     * We have no previous point at the end of the full history, that's why we have to compare it with the empty stats.
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

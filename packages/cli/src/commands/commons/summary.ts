import type { Statistic } from "@allurereport/core-api";
import type { AllureStore } from "@allurereport/plugin-api";

export const collectReportSummary = async (
  store: AllureStore,
  name: string,
): Promise<{
  name: string;
  duration: number;
  stats: Statistic;
  newTests: number;
  flakyTests: number;
  retryTests: number;
}> => {
  const current = await store.allTestResults({ includeRetries: false });
  const ids = new Set(current.map(({ id }) => id));
  const newIds = new Set((await store.allNewTestResults()).map(({ id }) => id));
  const stats = await store.testsStatistic();

  return {
    name,
    duration: current.reduce((sum, result) => sum + (result.duration ?? 0), 0),
    stats,
    newTests: [...newIds].filter((id) => ids.has(id)).length,
    flakyTests: stats.flaky ?? 0,
    retryTests: stats.retries ?? 0,
  };
};

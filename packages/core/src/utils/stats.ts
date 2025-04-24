import type { Statistic, TestResult } from "@allurereport/core-api";

export const getTestResultsStats = (trs: TestResult[], filter: (tr: TestResult) => boolean = () => true): Statistic => {
  const trsToProcess = trs.filter(filter);

  return trsToProcess.reduce<Statistic>(
    (acc, tr) => {
      if (filter && !filter(tr)) {
        return acc;
      }

      if (tr.retries && tr.retries?.length > 0) {
        acc.retries = (acc.retries ?? 0) + 1;
      }

      if (tr.flaky) {
        acc.flaky = (acc.flaky ?? 0) + 1;
      }

      if (!acc[tr.status]) {
        acc[tr.status] = 0;
      }

      acc[tr.status]!++;

      return acc;
    },
    { total: trsToProcess.length },
  );
};

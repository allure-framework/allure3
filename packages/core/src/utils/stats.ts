import type { Statistic, TestResult } from "@allurereport/core-api";

export const getTestResultsStats = (trs: TestResult[], filter: (tr: TestResult) => boolean = () => true) => {
  const trsToProcess = trs.filter(filter);

  return trsToProcess.reduce(
    (acc, test) => {
      if (filter && !filter(test)) {
        return acc;
      }

      if (!acc[test.status]) {
        acc[test.status] = 0;
      }

      acc[test.status]!++;

      return acc;
    },
    { total: trsToProcess.length } as Statistic,
  );
};

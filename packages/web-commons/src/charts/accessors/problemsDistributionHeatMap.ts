import type { HeatMapDataAccessor, HeatMapPoint } from "@allurereport/charts-api";
import { type TestResult, filterIncludedInSuccessRate } from "@allurereport/core-api";

const groupTestsByEnvironment = (testResults: TestResult[]): Record<string, TestResult[]> => {
  return testResults.reduce(
    (acc, testResult) => {
      const key = testResult.environment;

      if (key) {
        const bucket = acc[key] || (acc[key] = []);
        bucket.push(testResult);
      }

      return acc;
    },
    {} as Record<string, TestResult[]>,
  );
};

const groupByExactLabel = (testResults: TestResult[], labelNames: string[]): Record<string, TestResult[]> => {
  return testResults.reduce(
    (acc, testResult) => {
      const labels = testResult.labels;

      if (!labels) {
        return acc;
      }

      for (const label of labels) {
        const key = label.value;

        if (labelNames.includes(label.name) && key) {
          const bucket = acc[key] || (acc[key] = []);
          bucket.push(testResult);
        }
      }

      return acc;
    },
    {} as Record<string, TestResult[]>,
  );
};

const makeHeatMapSerie = (env: string, testResults: TestResult[]) => {
  const testResultsByExactLabel = groupByExactLabel(testResults, ["feature"]);
  const data: HeatMapPoint[] = [];

  for (const [labelValue, testsByLabelValue] of Object.entries(testResultsByExactLabel)) {
    const testsTotal = testsByLabelValue.length;
    const totalNegative = testsByLabelValue.reduce((acc, test) => acc + (test.status !== "passed" ? 1 : 0), 0);

    data.push({
      x: labelValue,
      y: totalNegative / testsTotal,
    });
  }

  return {
    id: env,
    // Sorting features by total failed tests in series, ascending
    data: data.sort((a, b) => (a.y || 0) - (b.y || 0)),
  };
};

const makeHeatMapData = (testsByEnvironment: Record<string, TestResult[]>) => {
  return Object.entries(testsByEnvironment).map(([env, tests]) => makeHeatMapSerie(env, tests));
};

const filterTestResultsBySignificantStatus = (testResults: TestResult[]) => {
  return testResults.filter(filterIncludedInSuccessRate);
};

const filterTestResultsByLabelNames = (testResults: TestResult[], labelNames: string[]) => {
  return testResults.filter((test) => test.labels?.some((l) => labelNames.includes(l.name)));
};

export const problemsDistributionHeatMapAccessor: HeatMapDataAccessor = {
  getHeatMap: ({ testResults }) => {
    const filteredTestResults = filterTestResultsBySignificantStatus(
      filterTestResultsByLabelNames(testResults, ["feature"]),
    );

    const testsResultsByEnvironment = groupTestsByEnvironment(filteredTestResults);
    const data = makeHeatMapData(testsResultsByEnvironment);

    // Prepare totals for sorting references
    const totals = new Map<string, number>();

    for (const serie of data) {
      const total = serie.data.reduce((acc, sd) => acc + (sd.y || 0), 0);
      totals.set(serie.id, total);
    }

    // Sorting environments by total failed tests in series, ascending
    return data.sort((a, b) => totals.get(a.id)! - totals.get(b.id)!);
  },
};

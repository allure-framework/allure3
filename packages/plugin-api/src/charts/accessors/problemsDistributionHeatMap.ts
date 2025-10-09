import { filterIncludedInSuccessRate, type TestResult, type HeatMapPoint } from "@allurereport/core-api";
import type { HeatMapDataAccessor } from "../../charts.js";

const getTestsByEnvironment = (testResults: TestResult[]): Record<string, TestResult[]> => {
  return testResults.reduce((acc, testResult) => {
    const key = testResult.environment;

    if (key) {
      acc[key] = [...(acc[key] || []), testResult];
    }

    return acc;
  }, {} as Record<string, TestResult[]>);
};

const groupByExactLabel = (testResults: TestResult[], labelNames: string[]): Record<string, TestResult[]> => {
  return testResults.reduce((acc, testResult) => {
    const keys = testResult.labels?.filter(l => labelNames.includes(l.name));

    keys.forEach(l => {
      const key = l.value;

      if (key) {
        acc[key] = [...(acc[key] || []), testResult];
      }
    });

    return acc;
  }, {} as Record<string, TestResult[]>);
};

const makeHeatMapSerie = (env: string, testResults: TestResult[]) => {
  const testResultsByExactLabel = groupByExactLabel(testResults, ["feature"]);
  const data = Object.entries(testResultsByExactLabel).reduce((acc, [labelValue, testsByLabelValue]) => {
    const testsTotal = testsByLabelValue.length;
    const totalNegative = testsByLabelValue.reduce((accCount, test) => accCount + (test.status !== "passed" ? 1 : 0), 0);

    acc.push({
      x: labelValue,
      y: totalNegative / testsTotal,
    });

    return acc;
  }, [] as HeatMapPoint[]);

  // Sorting features by total failed tests in serie, descending
  const sortedData = data.sort((a, b) => (a.y || 0) - (b.y || 0));

  return {
    id: env,
    data: sortedData
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
    const filteredTestResults = filterTestResultsBySignificantStatus(filterTestResultsByLabelNames(testResults, ["feature"]));

    const testsResultsByEnvironment = getTestsByEnvironment(filteredTestResults);
    const data = makeHeatMapData(testsResultsByEnvironment);

    // Sorting environments by total failed tests in series, descending
    const dataWithTotalFailed = data.map((d) => ({...d, totalFailed: d.data.reduce((acc, sd) => acc + (sd.y || 0), 0)}));
    const sortedData = dataWithTotalFailed.sort((a, b) => a.totalFailed - b.totalFailed);

    return sortedData.map(({totalFailed, ...d}) => d);
  },
};

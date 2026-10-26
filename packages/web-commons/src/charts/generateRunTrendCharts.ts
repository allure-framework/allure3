import type {
  AllureChartsStoreData,
  CategoriesTrendChartData,
  DurationTrendChartData,
  RetriesTrendChartData,
  RunTrendChartOptions,
  RunTrendPoint,
} from "@allurereport/charts-api";
import { ChartType, DEFAULT_CHART_HISTORY_LIMIT } from "@allurereport/charts-api";
import {
  type CategoryDefinition,
  type HistoryTestResult,
  type TestResult,
  extractErrorMatchingData,
  matchCategory,
  normalizeCategoriesConfig,
} from "@allurereport/core-api";

import { limitHistoryDataPoints } from "./chart-utils.js";

type RunTestResult = TestResult | HistoryTestResult;

type Run = RunTrendPoint & {
  testResults: RunTestResult[];
  /**
   * The number of earlier attempts of the tests in the run
   */
  retries: number;
};

/**
 * Collects the runs shown on a trend chart: the latest history points in chronological order, then the current run
 */
const collectRuns = (storeData: AllureChartsStoreData, limit: number, reportName: string): Run[] => {
  const { historyDataPoints, testResults, allTestResults } = storeData;
  const history = limitHistoryDataPoints(historyDataPoints, limit - 1)
    .map((point) => {
      const historyTestResults = Object.values(point.testResults ?? {});

      return {
        id: point.uuid,
        name: point.name,
        timestamp: point.timestamp,
        testResults: historyTestResults,
        retries: historyTestResults.reduce((acc, tr) => acc + (tr.retries?.length ?? 0), 0),
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);
  const current: Run = {
    id: "current",
    name: reportName,
    // history points are stamped with the time the report is generated
    timestamp: Date.now(),
    testResults,
    retries: allTestResults
      ? allTestResults.filter((tr) => tr.isRetry).length
      : testResults.reduce((acc, tr) => acc + (tr.retries?.length ?? 0), 0),
  };

  return limit > 0 ? [...history, current] : [];
};

const toPoint = ({ id, name, timestamp }: Run): RunTrendPoint => ({ id, name, timestamp });

/**
 * The time from the start of the first test to the end of the last one, as Allure 2 counts the run duration
 */
const getRunDuration = (testResults: RunTestResult[]) => {
  let start = Infinity;
  let stop = -Infinity;

  for (const tr of testResults) {
    if (typeof tr.start === "number") {
      start = Math.min(start, tr.start);
    }

    if (typeof tr.stop === "number") {
      stop = Math.max(stop, tr.stop);
    }
  }

  return Number.isFinite(start) && Number.isFinite(stop) ? Math.max(0, stop - start) : 0;
};

export const generateDurationTrendChart = (props: {
  options: RunTrendChartOptions;
  storeData: AllureChartsStoreData;
  reportName: string;
}): DurationTrendChartData => {
  const { options, storeData, reportName } = props;
  const { title, limit = DEFAULT_CHART_HISTORY_LIMIT } = options;

  return {
    type: ChartType.DurationTrend,
    title,
    data: collectRuns(storeData, limit, reportName).map((run) => ({
      ...toPoint(run),
      duration: getRunDuration(run.testResults),
    })),
  };
};

export const generateRetriesTrendChart = (props: {
  options: RunTrendChartOptions;
  storeData: AllureChartsStoreData;
  reportName: string;
}): RetriesTrendChartData => {
  const { options, storeData, reportName } = props;
  const { title, limit = DEFAULT_CHART_HISTORY_LIMIT } = options;

  return {
    type: ChartType.RetriesTrend,
    title,
    data: collectRuns(storeData, limit, reportName).map((run) => ({
      ...toPoint(run),
      run: run.testResults.length,
      retry: run.retries,
    })),
  };
};

/**
 * Returns the category of a current or historical test result, the first matching one.
 * History written by older versions has no flaky flag and transition, such results are matched as not flaky
 */
const matchTestCategory = (categories: CategoryDefinition[], tr: RunTestResult) => {
  const error = tr.error ?? ("message" in tr || "trace" in tr ? { message: tr.message, trace: tr.trace } : undefined);
  const matched = matchCategory(
    categories,
    extractErrorMatchingData({
      status: tr.status,
      labels: tr.labels ?? [],
      error,
      flaky: tr.flaky ?? false,
      duration: tr.duration,
      transition: tr.transition,
      environment: tr.environment,
    }),
  );

  return matched && !matched.hide ? matched : undefined;
};

export const generateCategoriesTrendChart = (props: {
  options: RunTrendChartOptions;
  storeData: AllureChartsStoreData;
  reportName: string;
}): CategoriesTrendChartData => {
  const { options, storeData, reportName } = props;
  const { title, limit = DEFAULT_CHART_HISTORY_LIMIT } = options;
  const categories = storeData.categories ?? normalizeCategoriesConfig(undefined);
  const presentCategories = new Set<string>();
  const data = collectRuns(storeData, limit, reportName).map((run) => {
    const counts: Record<string, number> = {};

    for (const tr of run.testResults) {
      const category = matchTestCategory(categories, tr);

      if (category) {
        counts[category.name] = (counts[category.name] ?? 0) + 1;
        presentCategories.add(category.name);
      }
    }

    return { ...toPoint(run), categories: counts };
  });

  return {
    type: ChartType.CategoriesTrend,
    title,
    data,
    categories: [...new Set(categories.map(({ name }) => name))].filter((name) => presentCategories.has(name)),
  };
};

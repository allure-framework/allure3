import {
  type AllureChartsStoreData,
  type ChartOptions,
  ChartType,
  type GeneratedChartsData,
} from "@allurereport/charts-api";
import {
  DEFAULT_ENVIRONMENT,
  emptyStatistic,
  getFallbackHistoryId,
  incrementStatistic,
  type EnvironmentIdentity,
  type HistoryDataPoint,
  type Statistic,
  type TestResult,
} from "@allurereport/core-api";
import { type AllureStore } from "@allurereport/plugin-api";

import { generateCurrentStatusChart } from "./generateCurrentStatusChart.js";
import { generateDurationDynamicsChart } from "./generateDurationDynamicsChart.js";
import { generateDurationsChart } from "./generateDurationsChart.js";
import { generateStabilityDistributionChart } from "./generateStabilityDistributionChart.js";
import { generateStatusAgePyramid } from "./generateStatusAgePyramid.js";
import { generateStatusDynamicsChart } from "./generateStatusDynamicsChart.js";
import { generateStatusTransitionsChart } from "./generateStatusTransitionsChart.js";
import { generateTestBaseGrowthDynamicsChart } from "./generateTestBaseGrowthDynamicsChart.js";
import { generateTestingPyramidChart } from "./generateTestingPyramidChart.js";
import { generateTrSeveritiesChart } from "./generateTrSeveritiesChart.js";
import { generateHeatMapChart } from "./heatMap.js";
import { generateTreeMapChart } from "./treeMap.js";

const buildFallbackHistoryAliases = (testResults: TestResult[]): Map<string, string> => {
  const aliases = new Map<string, string>();
  const ambiguousAliases = new Set<string>();

  for (const testResult of testResults) {
    if (!testResult.historyId) {
      continue;
    }

    const fallbackHistoryId = getFallbackHistoryId(testResult);

    if (!fallbackHistoryId || fallbackHistoryId === testResult.historyId) {
      continue;
    }

    const existingAlias = aliases.get(fallbackHistoryId);

    if (existingAlias && existingAlias !== testResult.historyId) {
      aliases.delete(fallbackHistoryId);
      ambiguousAliases.add(fallbackHistoryId);
      continue;
    }

    if (!ambiguousAliases.has(fallbackHistoryId)) {
      aliases.set(fallbackHistoryId, testResult.historyId);
    }
  }

  return aliases;
};

const normalizeHistoryDataPointsByAliases = (
  historyDataPoints: HistoryDataPoint[],
  aliases: Map<string, string>,
): HistoryDataPoint[] => {
  if (aliases.size === 0) {
    return historyDataPoints;
  }

  return historyDataPoints.map((historyDataPoint) => {
    let testResults = historyDataPoint.testResults;

    for (const [legacyHistoryId, primaryHistoryId] of aliases) {
      if (!Object.prototype.hasOwnProperty.call(testResults, legacyHistoryId)) {
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(testResults, primaryHistoryId)) {
        continue;
      }

      if (testResults === historyDataPoint.testResults) {
        testResults = { ...testResults };
      }

      testResults[primaryHistoryId] = {
        ...testResults[legacyHistoryId],
        historyId: primaryHistoryId,
      };
      delete testResults[legacyHistoryId];
    }

    if (testResults === historyDataPoint.testResults) {
      return historyDataPoint;
    }

    return {
      ...historyDataPoint,
      testResults,
    };
  });
};

const generateChartData = async (props: {
  envId?: string;
  chartsOptions: ChartOptions[];
  store: AllureStore;
  reportName: string;
  generateUuid: () => string;
  filter?: (testResult: TestResult) => boolean;
}) => {
  const { envId, chartsOptions, store, generateUuid, filter } = props;
  const result: GeneratedChartsData = {};

  const getTrs = async (): Promise<TestResult[]> => {
    let trs: TestResult[] = [];

    if (envId) {
      trs = await store.testResultsByEnvironmentId(envId);
    } else {
      trs = await store.allTestResults();
    }

    if (filter) {
      trs = trs.filter(filter);
    }

    return trs;
  };

  const getHistoryDataPoints = async (): Promise<HistoryDataPoint[]> => {
    let historyDataPoints: HistoryDataPoint[] = [];

    if (envId) {
      historyDataPoints = await store.allHistoryDataPointsByEnvironmentId(envId);
    } else {
      historyDataPoints = await store.allHistoryDataPoints();
    }

    if (typeof filter === "function") {
      historyDataPoints = historyDataPoints.map((hdp) => {
        const trsEntries = Object.entries(hdp.testResults);
        const filteredTrsEntries = trsEntries.filter(([, tr]) => {
          try {
            // Just in case filter accesses some property
            // that is not present in the history test result
            return filter(tr as unknown as TestResult);
          } catch (error) {
            return false;
          }
        });

        return {
          ...hdp,
          testResults: Object.fromEntries(filteredTrsEntries),
        };
      });
    }

    return historyDataPoints;
  };

  const getStatistic = async (): Promise<Statistic> => {
    const statistic = emptyStatistic();

    for (const tr of await getTrs()) {
      incrementStatistic(statistic, tr.status);
    }

    return statistic;
  };

  const storeData: AllureChartsStoreData = await Promise.all([getHistoryDataPoints(), getTrs(), getStatistic()]).then(
    ([historyDataPoints, testResults, statistic]) => {
      const fallbackHistoryAliases = buildFallbackHistoryAliases(testResults);

      return {
        historyDataPoints: normalizeHistoryDataPointsByAliases(historyDataPoints, fallbackHistoryAliases),
        testResults,
        statistic,
      };
    },
  );

  for (const chartOption of chartsOptions) {
    const chartId = generateUuid();

    switch (chartOption.type) {
      case ChartType.CurrentStatus:
        result[chartId] = generateCurrentStatusChart(chartOption, storeData)!;
        break;
      case ChartType.StatusDynamics:
        result[chartId] = generateStatusDynamicsChart({ options: chartOption, storeData })!;
        break;
      case ChartType.StatusTransitions:
        result[chartId] = generateStatusTransitionsChart({ options: chartOption, storeData })!;
        break;
      case ChartType.Durations:
        result[chartId] = generateDurationsChart({ options: chartOption, storeData })!;
        break;
      case ChartType.DurationDynamics:
        result[chartId] = generateDurationDynamicsChart({ options: chartOption, storeData })!;
        break;
      case ChartType.StabilityDistribution:
        result[chartId] = generateStabilityDistributionChart({ options: chartOption, storeData })!;
        break;
      case ChartType.TestBaseGrowthDynamics:
        result[chartId] = generateTestBaseGrowthDynamicsChart({ options: chartOption, storeData })!;
        break;
      case ChartType.StatusAgePyramid:
        result[chartId] = generateStatusAgePyramid({ options: chartOption, storeData })!;
        break;
      case ChartType.TrSeverities:
        result[chartId] = generateTrSeveritiesChart({ options: chartOption, storeData })!;
        break;
      case ChartType.CoverageDiff:
        result[chartId] = generateTreeMapChart(chartOption, storeData)!;
        break;
      case ChartType.SuccessRateDistribution:
        result[chartId] = generateTreeMapChart(chartOption, storeData)!;
        break;
      case ChartType.ProblemsDistribution:
        result[chartId] = generateHeatMapChart(chartOption, storeData)!;
        break;
      case ChartType.TestingPyramid:
        result[chartId] = generateTestingPyramidChart(chartOption, storeData)!;
        break;
      default:
        break;
    }
  }

  return result;
};

type ChartsWidgetData = {
  /**
   * General charts data for all environments
   */
  general: GeneratedChartsData;
  /**
   * Charts data for each environment.
   */
  byEnv: {
    [env: string]: GeneratedChartsData;
  };
};

const hasOnlyDefaultEnvironment = (environments: EnvironmentIdentity[]): boolean => {
  return environments.length === 1 && environments[0].id === DEFAULT_ENVIRONMENT;
};

export const generateCharts = async (
  chartsOptions: ChartOptions[],
  store: AllureStore,
  reportName: string,
  generateUuid: () => string,
  filter?: (testResult: TestResult) => boolean,
): Promise<ChartsWidgetData> => {
  const environments = await store.allEnvironmentIdentities();

  const chartsData: ChartsWidgetData = {
    general: await generateChartData({ chartsOptions, store, reportName, generateUuid, filter }),
    byEnv: {},
  };

  // If there is only one environment, return only the general data
  if (hasOnlyDefaultEnvironment(environments)) {
    return chartsData;
  }

  for (const environment of environments) {
    chartsData.byEnv[environment.id] = await generateChartData({
      chartsOptions,
      store,
      reportName,
      envId: environment.id,
      generateUuid,
      filter,
    });
  }

  return chartsData;
};

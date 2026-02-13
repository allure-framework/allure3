import {
  type AllureChartsStoreData,
  type ChartOptions,
  ChartType,
  type GeneratedChartsData,
} from "@allurereport/charts-api";
import type { HistoryDataPoint, Statistic, TestResult } from "@allurereport/core-api";
import { DEFAULT_ENVIRONMENT } from "@allurereport/core-api";
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

const generateChartData = async (props: {
  env?: string;
  chartsOptions: ChartOptions[];
  store: AllureStore;
  reportName: string;
  generateUuid: () => string;
  filter?: (testResult: TestResult) => boolean;
}) => {
  const { env, chartsOptions, store, generateUuid, filter } = props;
  const result: GeneratedChartsData = {};

  const getTrs = async (): Promise<TestResult[]> => {
    let trs: TestResult[] = [];

    if (env) {
      trs = await store.testResultsByEnvironment(env);
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
    if (env) {
      historyDataPoints = await store.allHistoryDataPointsByEnvironment(env);
    }
    historyDataPoints = await store.allHistoryDataPoints();

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

  const getStatistic = (): Promise<Statistic> => {
    return store.testsStatistic((tr) => {
      if (env && tr.environment !== env) {
        return false;
      }
      if (typeof filter === "function" && !filter(tr)) {
        return false;
      }

      return true;
    });
  };

  const storeData: AllureChartsStoreData = await Promise.all([
    await getHistoryDataPoints(),
    await getTrs(),
    await getStatistic(),
  ]).then(([historyDataPoints, testResults, statistic]) => ({
    historyDataPoints,
    testResults,
    statistic,
  }));

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

const hasOnlyDefaultEnvironment = (environments: string[]): boolean => {
  return environments.length === 1 && environments[0] === DEFAULT_ENVIRONMENT;
};

export const generateCharts = async (
  chartsOptions: ChartOptions[],
  store: AllureStore,
  reportName: string,
  generateUuid: () => string,
  filter?: (testResult: TestResult) => boolean,
): Promise<ChartsWidgetData> => {
  const environments = await store.allEnvironments();

  const chartsData: ChartsWidgetData = {
    general: await generateChartData({ chartsOptions, store, reportName, generateUuid, filter }),
    byEnv: {},
  };

  // If there is only one environment, return only the general data
  if (hasOnlyDefaultEnvironment(environments)) {
    return chartsData;
  }

  for (const environment of environments) {
    chartsData.byEnv[environment] = await generateChartData({
      chartsOptions,
      store,
      reportName,
      env: environment,
      generateUuid,
      filter,
    });
  }

  return chartsData;
};

import {
  type AllureChartsStoreData,
  type ChartOptions,
  ChartType,
  type GeneratedChartsData,
} from "@allurereport/charts-api";
import { DEFAULT_ENVIRONMENT } from "@allurereport/core-api";
import { type AllureStore } from "@allurereport/plugin-api";
import { generateFunnelChart } from "./funnel/index.js";
import { generateCurrentStatusChart } from "./generateCurrentStatusChart.js";
import { generateDurationDynamicsChart } from "./generateDurationDynamicsChart.js";
import { generateDurationsChart } from "./generateDurationsChart.js";
import { generateFBSUAgePyramid } from "./generateFBSUAgePyramid.js";
import { generateStabilityDistributionChart } from "./generateStabilityDistributionChart.js";
import { generateStatusDynamicsChart } from "./generateStatusDynamicsChart.js";
import { generateStatusTransitionsChart } from "./generateStatusTransitionsChart.js";
import { generateTestBaseGrowthDynamicsChart } from "./generateTestBaseGrowthDynamicsChart.js";
import { generateTrSeveritiesChart } from "./generateTrSeveritiesChart.js";
import { generateHeatMapChart } from "./heatMap.js";
import { generateTrendChart } from "./line.js";
import { generateTreeMapChart } from "./treeMap.js";

const generateChartData = async (props: {
  env?: string;
  chartsOptions: ChartOptions[];
  store: AllureStore;
  reportName: string;
  generateUuid: () => string;
}) => {
  const { env, chartsOptions, store, reportName, generateUuid } = props;
  const result: GeneratedChartsData = {};

  const storeData: AllureChartsStoreData = await Promise.all([
    env ? await store.allHistoryDataPointsByEnvironment(env) : await store.allHistoryDataPoints(),
    env ? await store.testResultsByEnvironment(env) : await store.allTestResults(),
    env ? await store.testsStatistic((tr) => tr.environment === env) : await store.testsStatistic(),
  ]).then(([historyDataPoints, testResults, statistic]) => ({
    historyDataPoints,
    testResults,
    statistic,
  }));

  for (const chartOption of chartsOptions) {
    const chartId = generateUuid();

    switch (chartOption.type) {
      case ChartType.Trend:
        result[chartId] = generateTrendChart(chartOption, storeData, reportName)!;
        break;
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
      case ChartType.FBSUAgePyramid:
        result[chartId] = generateFBSUAgePyramid({ options: chartOption, storeData })!;
        break;
      case ChartType.TrSeverities:
        result[chartId] = generateTrSeveritiesChart({ options: chartOption, storeData })!;
        break;
      case ChartType.TreeMap:
        result[chartId] = generateTreeMapChart(chartOption, storeData)!;
        break;
      case ChartType.HeatMap:
        result[chartId] = generateHeatMapChart(chartOption, storeData)!;
        break;
      case ChartType.Funnel:
        result[chartId] = generateFunnelChart(chartOption, storeData)!;
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
): Promise<ChartsWidgetData> => {
  const environments = await store.allEnvironments();

  const chartsData: ChartsWidgetData = {
    general: await generateChartData({ chartsOptions, store, reportName, generateUuid }),
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
    });
  }

  return chartsData;
};

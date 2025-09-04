import { ChartType } from "@allurereport/core-api";
import {
  type AllureStore,
  type ComingSoonChartOptions,
  type GeneratedChartData,
  type GeneratedChartsData,
  type PluginContext,
  generateBarChart,
  generateComingSoonChart,
  generatePieChart,
  generateTrendChart,
} from "@allurereport/plugin-api";
import { randomUUID } from "crypto";
import type { AwesomeOptions } from "./model.js";
import type { AwesomeDataWriter } from "./writer.js";

export const generateCharts = async (
  options: AwesomeOptions,
  store: AllureStore,
  context: PluginContext,
): Promise<GeneratedChartsData | undefined> => {
  const { charts } = options;

  if (!charts) {
    return undefined;
  }

  const statistic = await store.testsStatistic();

  const chartsData: GeneratedChartsData = {};

  for (const chartOptions of charts) {
    const chartId = randomUUID();

    let chart: GeneratedChartData | undefined;

    if (chartOptions.type === ChartType.Trend) {
      chart = await generateTrendChart(chartOptions, store, context);
    } else if (chartOptions.type === ChartType.Pie) {
      chart = generatePieChart(chartOptions, { statistic });
    } else if (chartOptions.type === ChartType.Bar) {
      chart = await generateBarChart(chartOptions, store);
    }

    if (chart) {
      chartsData[chartId] = chart;
    } else {
      chartsData[chartId] = generateComingSoonChart(chartOptions as ComingSoonChartOptions);
    }
  }

  return chartsData;
};

export const generateAllCharts = async (
  writer: AwesomeDataWriter,
  store: AllureStore,
  options: AwesomeOptions,
  context: PluginContext,
): Promise<void> => {
  const charts = await generateCharts(options, store, context);

  if (charts && Object.keys(charts).length > 0) {
    await writer.writeWidget("charts.json", charts);
  }
};

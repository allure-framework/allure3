import { ChartType, type HistoryDataPoint, type Statistic, type TestResult } from "@allurereport/core-api";
import {
  type GeneratedChartData,
  type GeneratedChartsData,
  type PluginContext,
  generatePieChart,
  generateTrendChart,
} from "@allurereport/plugin-api";
import { randomUUID } from "crypto";
import type { AwesomeOptions } from "./model.js";
import type { AwesomeDataWriter } from "./writer.js";

export const generateCharts = async (
  options: AwesomeOptions,
  context: PluginContext,
  stores: {
    trs: TestResult[];
    statistic: Statistic;
    history: HistoryDataPoint[];
  },
): Promise<GeneratedChartsData | undefined> => {
  const { charts } = options;

  if (!charts) {
    return undefined;
  }

  return charts.reduce(
    (acc, chartOptions) => {
      const chartId = randomUUID();

      let chart: GeneratedChartData | undefined;

      if (chartOptions.type === ChartType.Trend) {
        chart = generateTrendChart(chartOptions, stores, context);
      } else if (chartOptions.type === ChartType.Pie) {
        chart = generatePieChart(chartOptions, stores);
      }

      if (chart) {
        acc[chartId] = chart;
      }

      return acc;
    },
    {} as Record<string, GeneratedChartData>,
  );
};

export const generateAllCharts = async (
  writer: AwesomeDataWriter,
  options: AwesomeOptions,
  context: PluginContext,
  stores: {
    trs: TestResult[];
    statistic: Statistic;
    history: HistoryDataPoint[];
  },
): Promise<void> => {
  const charts = await generateCharts(options, context, stores);

  if (charts && Object.keys(charts).length > 0) {
    await writer.writeWidget("charts.json", charts);
  }
};
